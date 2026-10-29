import { useState, useEffect, useMemo, useCallback, useRef, useId } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUpDown, ChevronDown, Package, ScanBarcode, Store, Trash2, Truck, Warehouse } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import CotThuocTinh, { NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import BangHangTaoPhieu from "@/components/chung-tu/BangHangTaoPhieu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { donBanHangService } from "@/services/donBanHangService";
import { khoService } from "@/services/khoService";
import { laKhoGiaoDich, laKhoTong } from "@/utils/kho";
import { dsKhoLamViecTrongToken, getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { soNguyenDuong } from "@/utils/thamSoDuongDan";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { NGUONG_CONG_CU } from "@/config/bangChungTu";

/**
 * Tạo phiếu chuyển kho nội bộ (/transfer-tickets/create): khối chứng từ "một khối" như Chi tiết phiếu chuyển.
 * POST /phieu-chuyen-kho/create { khoXuatId, khoNhapId, ghiChu, chiTietXuat } → phiếu Chờ duyệt (đặc tả BA không có
 * bước nháp): số lượng được giữ chỗ ở kho nguồn, Quản lý Kho tổng duyệt và lập lệnh điều động. Điền sẵn từ đường dẫn
 * ?khoXuatId=&khoNhapId=&bienTheId=&soLuong= như cũ.
 *
 * Theo đúng kiểm tra của máy chủ (PhieuChuyenKhoService.tao):
 * - Quản trị viên, Quản lý Kho tổng tạo mọi tuyến; người khác chỉ tạo yêu cầu NHẬP về kho mình được phân → kho đích chỉ
 *   liệt kê kho trong quyền; trước khi gửi, làm việc luôn ở kho đích (header kho_id).
 * - Máy chủ kiểm số có thể chuyển ở kho nguồn (trừ hàng đang giữ chỗ cho phiếu chuyển khác) khi tạo; màn chưa có API
 *   tồn theo kho nên không hiện cột tồn.
 */

const DROPDOWN_CONTENT_CLASS = "z-50 max-h-[300px] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[240px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const DROPDOWN_ITEM_CLASS = "flex cursor-pointer flex-col items-start rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const SO_KET_QUA_TOI_DA = 20;
const GHI_CHU_TOI_DA = 500;

const BUOC = [
    { ma: "yeuCau", nhan: "Yêu cầu", ai: "Kho nhận", trangThai: "dangLam", phu: "Đang lập" },
    { ma: "lenh", nhan: "Lệnh điều động", ai: "Quản lý Kho tổng", trangThai: "chua" },
    { ma: "xuat", nhan: "Xuất kho", ai: "Kho xuất", trangThai: "chua" },
    { ma: "vanChuyen", nhan: "Đang vận chuyển", ai: "Người vận chuyển", trangThai: "chua" },
    { ma: "nhan", nhan: "Nhận hàng", ai: "Kho nhận", trangThai: "chua" },
];

/** Một dòng hàng điều chuyển từ biến thể (dữ liệu /don-ban-hang/variants-for-create). */
function taoDongHang(bienThe, soLuong = 1) {
    return {
        variantId: bienThe.id,
        sku: bienThe.maBienThe,
        name: bienThe.tenSanPham,
        color: bienThe.tenMau,
        colorHex: bienThe.maMauHex,
        productId: bienThe.sanPhamId,
        size: bienThe.tenSize,
        material: bienThe.tenChatLieu,
        quantity: soLuong,
    };
}

/**
 * Đọc đề xuất trên đường dẫn: ?khoXuatId=&khoNhapId=&bienTheId=&soLuong=
 * (nút "Chuyển … từ Kho tổng" ở Tổng quan). Không có tham số nào thì trả về null.
 * - Chỉ nhận kho có trong danh sách chọn được (đang hoạt động, không phải kho ảo).
 * - Kho xuất thiếu, sai hoặc trùng kho nhận thì dùng Kho tổng (kho bán hàng nhận hàng từ Kho tổng).
 * - Mã hàng phải nằm trong danh sách đang kinh doanh; số lượng sai thì về 1.
 */
function docDeXuatTuDuongDan(thamSo, dsKho, dsKhoNhan, dsBienThe) {
    const khoXuatIdUrl = thamSo.get("khoXuatId");
    const khoNhapIdUrl = thamSo.get("khoNhapId");
    const bienTheIdUrl = thamSo.get("bienTheId");
    if (!khoXuatIdUrl && !khoNhapIdUrl && !bienTheIdUrl) return null;

    const timKho = (ds, id) => (id ? ds.find((k) => String(k.id) === String(id)) : undefined);
    const khoNhap = timKho(dsKhoNhan, khoNhapIdUrl);
    let khoXuat = timKho(dsKho, khoXuatIdUrl);
    if ((khoXuatIdUrl || khoNhapIdUrl) && (!khoXuat || khoXuat.id === khoNhap?.id)) {
        const khoTong = dsKho.find(laKhoTong);
        khoXuat = khoTong && khoTong.id !== khoNhap?.id ? khoTong : undefined;
    }
    const bienThe = bienTheIdUrl ? dsBienThe.find((v) => String(v.id) === String(bienTheIdUrl)) : undefined;

    const canhBao = [];
    if (khoNhapIdUrl && !khoNhap) canhBao.push("Kho nhận trong đề xuất không còn chọn được (đã ngừng hoạt động, không tồn tại hoặc không thuộc kho bạn phụ trách), hãy chọn lại kho nhận.");
    if (bienTheIdUrl && !bienThe) canhBao.push("Không tìm thấy sản phẩm trong đề xuất (có thể đã ngừng kinh doanh), hãy tìm và thêm lại.");
    return {
        khoXuatId: khoXuat ? String(khoXuat.id) : "",
        khoNhapId: khoNhap ? String(khoNhap.id) : "",
        dongHang: bienThe ? taoDongHang(bienThe, soNguyenDuong(thamSo.get("soLuong"))) : null,
        canhBao,
    };
}

/** Câu lỗi tải danh sách sản phẩm: 403 → thiếu quyền (Thử lại vô ích); còn lại câu của máy chủ, bỏ dấu chấm cuối. */
function moTaLoiBienThe(e) {
    if (getApiErrorStatus(e) === 403) {
        return { chu: "tài khoản chưa có quyền xem danh sách sản phẩm. Nhờ quản trị viên cấp quyền hoặc nhờ quản lý kho tạo phiếu", khongQuyen: true };
    }
    return { chu: getApiErrorMessage(e, "máy chủ không phản hồi").trim().replace(/[.。]+$/, ""), khongQuyen: false };
}

/** Ô chọn kho trong cột "Tuyến chuyển" (cùng dáng thẻ kho của TuyenChuyen ở Chi tiết phiếu chuyển). */
function ChonKho({ vaiTro, icon, mau, kho, dsKho, khoKhac, onChon, goiYTrong }) {
    const Icon = icon;
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex w-full min-w-0 items-center gap-2.5 rounded-md border border-bo-border bg-bo-surface px-2.5 py-2 text-left transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                >
                    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md", mau)}>
                        <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm leading-5", kho ? "font-semibold text-bo-foreground" : "font-medium text-bo-muted")}>
                            {kho ? kho.tenKho : `Chọn ${vaiTro.toLowerCase()}`}
                        </span>
                        <span className="block text-xs leading-4 text-bo-muted">{vaiTro === "Kho nguồn" ? "Kho nguồn · xuất hàng" : "Kho đích · nhận hàng"}</span>
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={DROPDOWN_CONTENT_CLASS}>
                {dsKho.length ? dsKho.map((k) => {
                    const trung = String(k.id) === String(khoKhac);
                    return (
                        <DropdownMenuItem key={k.id} disabled={trung} onSelect={() => onChon(String(k.id))} className={DROPDOWN_ITEM_CLASS}>
                            <span className="font-medium text-slate-900">{k.tenKho}</span>
                            <span className="text-xs text-bo-muted">
                                {laKhoTong(k) ? "Kho tổng" : "Kho bán hàng"}{trung ? ` · đang là ${vaiTro === "Kho nguồn" ? "kho đích" : "kho nguồn"}` : ""}
                            </span>
                        </DropdownMenuItem>
                    );
                }) : (
                    <p className="px-2.5 py-2 text-sm text-bo-muted">{goiYTrong}</p>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function PhieuChuyenKhoCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const idDs = useId();
    // Quản trị viên, Quản lý Kho tổng tạo yêu cầu cho mọi tuyến; người khác chỉ yêu cầu nhận về kho mình (như máy chủ kiểm)
    const toanTuyen = hasAnyRole([ROLES.QUAN_TRI_VIEN])
        || (hasAnyRole([ROLES.QUAN_LY_KHO]) && dsKhoLamViecTrongToken().some(laKhoTong));
    // Chỉ điền sẵn một lần (StrictMode gọi tải dữ liệu 2 lần; không ghi đè khi người dùng đã sửa).
    const daDienSanRef = useRef(false);
    const oTimRef = useRef(null);
    const henSangRef = useRef(0);

    const [warehouses, setWarehouses] = useState([]);
    const [variants, setVariants] = useState([]);
    const [loiBienThe, setLoiBienThe] = useState(null); // { chu, khongQuyen } khi không tải được danh sách sản phẩm
    const [loiKho, setLoiKho] = useState(""); // câu lỗi khi không tải được danh sách kho
    const [dangTai, setDangTai] = useState(true);
    const dangTaoRef = useRef(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [moKetQua, setMoKetQua] = useState(false);
    const [dongSang, setDongSang] = useState(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ khoXuatId: "", khoNhapId: "", ghiChu: "" });
    const [transferItems, setTransferItems] = useState([]);

    useEffect(() => () => clearTimeout(henSangRef.current), []);

    // Kho đích: quản trị viên mọi kho giao dịch; người khác chỉ kho mình được phân (máy chủ chặn kho khác)
    const khoNhanDuoc = useMemo(() => {
        if (toanTuyen) return warehouses;
        const idQuyen = new Set(dsKhoLamViecTrongToken().map((k) => String(k.id)));
        return warehouses.filter((k) => idQuyen.has(String(k.id)));
    }, [warehouses, toanTuyen]);

    // Kho và sản phẩm tải độc lập: một bên lỗi thì bên kia vẫn dùng được, mỗi bên có dòng báo lỗi riêng
    const taiKho = useCallback(async () => {
        const khoRes = await khoService.filter({ page: 0, size: 100, filters: [] });
        const listKho = khoRes.data?.data?.content || khoRes.data?.content || [];
        // Bỏ Kho Trung Chuyển (kho ảo chứa hàng đang chuyển) và kho ngừng hoạt động
        return listKho.filter(laKhoGiaoDich);
    }, []);

    const loadInitialData = useCallback(async () => {
        setDangTai(true);
        try {
            const [kqBienThe, kqKho] = await Promise.allSettled([
                donBanHangService.getVariantsForCreate(),
                taiKho(),
            ]);
            let dsBienThe = [];
            if (kqBienThe.status === "fulfilled") {
                dsBienThe = kqBienThe.value?.data?.data || kqBienThe.value?.data || [];
                setLoiBienThe(null);
            } else {
                setLoiBienThe(moTaLoiBienThe(kqBienThe.reason));
            }
            setVariants(dsBienThe);
            if (kqKho.status === "rejected") {
                setLoiKho(getApiErrorMessage(kqKho.reason, "máy chủ không phản hồi").trim().replace(/[.。]+$/, ""));
                return;
            }
            setLoiKho("");
            const dsKho = kqKho.value;
            setWarehouses(dsKho);

            if (daDienSanRef.current) return;
            const idQuyen = new Set(dsKhoLamViecTrongToken().map((k) => String(k.id)));
            const dsKhoNhan = toanTuyen ? dsKho : dsKho.filter((k) => idQuyen.has(String(k.id)));
            const deXuat = docDeXuatTuDuongDan(searchParams, dsKho, dsKhoNhan, dsBienThe);
            daDienSanRef.current = true;
            if (!deXuat) {
                // Không có đề xuất: người không phải quản trị viên mặc định nhận về nơi đang làm việc
                if (!toanTuyen) {
                    const noiLamViec = dsKhoNhan.find((k) => Number(k.id) === getKhoLamViecId()) ?? (dsKhoNhan.length === 1 ? dsKhoNhan[0] : null);
                    if (noiLamViec) setFormData(prev => ({ ...prev, khoNhapId: prev.khoNhapId || String(noiLamViec.id) }));
                }
                return;
            }
            setFormData(prev => ({
                ...prev,
                khoXuatId: deXuat.khoXuatId || prev.khoXuatId,
                khoNhapId: deXuat.khoNhapId || prev.khoNhapId,
            }));
            if (deXuat.dongHang) {
                setTransferItems(prev => prev.some(i => i.variantId === deXuat.dongHang.variantId) ? prev : [...prev, deXuat.dongHang]);
            }
            if (deXuat.canhBao.length) {
                toast.warning(deXuat.canhBao.join(" "));
            } else {
                toast.success("Đã điền sẵn theo đề xuất bổ sung. Kiểm tra lại kho và số lượng trước khi tạo phiếu.");
            }
        } catch {
            toast.error("Không thể tải dữ liệu khởi tạo");
        } finally {
            setDangTai(false);
        }
    }, [searchParams, toanTuyen, taiKho]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => loadInitialData());
    }, [loadInitialData]);

    const filteredProducts = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        if (!lower) return variants.slice(0, SO_KET_QUA_TOI_DA);
        return variants.filter(v =>
            v.tenSanPham?.toLowerCase().includes(lower) ||
            v.maBienThe?.toLowerCase().includes(lower) ||
            v.maVachSku?.toLowerCase().includes(lower)
        ).slice(0, SO_KET_QUA_TOI_DA);
    }, [searchTerm, variants]);

    // Dòng bảng hàng dạng dòng chứng từ: gom theo sản phẩm, tìm và phân trang như màn chi tiết phiếu chuyển
    const dongBang = useMemo(() => transferItems.map(it => ({
        id: it.variantId,
        khoaNhom: it.productId ?? null,
        tenSanPham: it.name || it.sku || "",
        tenMau: it.color || "",
        maMauHex: it.colorHex || "",
        kichCo: it.size || "",
        sku: it.sku || "",
        chuTimThem: it.material || "",
        soLuong: Number(it.quantity) || 0,
        oNhap: it.quantity,
    })), [transferItems]);
    const bangHang = useBangChungTu(dongBang);
    const { denDong } = bangHang;

    // Vừa thêm / quét một mã: đưa bảng tới trang và nhóm có mã đó (hoãn qua microtask như lần tải dữ liệu)
    useEffect(() => {
        if (dongSang == null) return;
        queueMicrotask(() => denDong(dongSang));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dongSang]);

    const toSangDong = (variantId) => {
        setDongSang(variantId);
        clearTimeout(henSangRef.current);
        henSangRef.current = setTimeout(() => setDongSang(null), 1200);
    };

    // Chọn lại mã đã có (vd. quét lần nữa): cộng 1 thay vì báo trùng
    const handleAddProduct = (product) => {
        setTransferItems(prev => prev.some(i => i.variantId === product.id)
            ? prev.map(i => i.variantId === product.id ? { ...i, quantity: (Number(i.quantity) || 0) + 1 } : i)
            : [...prev, taoDongHang(product)]);
        toSangDong(product.id);
        setSearchTerm("");
        oTimRef.current?.focus();
    };

    // Enter: trùng đúng mã SKU (máy quét) thì lấy mã đó; không thì chỉ lấy khi còn đúng một kết quả, kẻo quét mã lạ
    // (chuỗi con của SKU / mã vạch khác) cộng nhầm sản phẩm
    const handleEnter = () => {
        const tuKhoa = searchTerm.trim().toLowerCase();
        if (!tuKhoa) return;
        // Máy quét gửi SKU hoặc mã vạch in trên tem
        const trungMa = variants.find(v => v.maBienThe?.toLowerCase() === tuKhoa || v.maVachSku?.toLowerCase() === tuKhoa);
        const chon = trungMa || (filteredProducts.length === 1 ? filteredProducts[0] : null);
        if (chon) handleAddProduct(chon);
        else if (filteredProducts.length > 1) toast.warning(`Nhiều sản phẩm khớp "${searchTerm.trim()}", chọn trong danh sách`);
        else if (loiBienThe) toast.error("Chưa tải được danh sách sản phẩm, xem dòng báo lỗi phía trên.");
        else toast.warning(`Không tìm thấy sản phẩm "${searchTerm.trim()}"`);
    };

    async function handleCreate() {
        if (dangTaoRef.current) return; // chặn bấm đúp (state chỉ cập nhật ở lần render sau)
        if (!formData.khoXuatId || !formData.khoNhapId)
            return toast.error("Vui lòng chọn đầy đủ kho gửi và kho nhận");
        if (formData.khoXuatId === formData.khoNhapId)
            return toast.error("Kho gửi và kho nhận không được trùng nhau");
        if (transferItems.length === 0)
            return toast.error("Vui lòng chọn ít nhất 1 sản phẩm để điều chuyển");
        dangTaoRef.current = true;
        try {
            setLoading(true);
            // Máy chủ kiểm header kho_id là kho của người dùng: làm việc luôn ở kho nhận (kho mình được phân)
            if (!toanTuyen && getKhoLamViecId() !== Number(formData.khoNhapId)) setKhoLamViecId(Number(formData.khoNhapId));
            const payload = {
                khoXuatId: parseInt(formData.khoXuatId),
                khoNhapId: parseInt(formData.khoNhapId),
                ghiChu: formData.ghiChu?.trim() || "",
                chiTietXuat: transferItems.map(item => ({
                    bienTheSanPhamId: item.variantId,
                    soLuongXuat: Number(item.quantity) || 1,
                })),
            };
            const res = await phieuChuyenKhoService.tao(payload);
            toast.success(`Đã tạo yêu cầu chuyển kho ${res?.soPhieuChuyen ?? ""}`.trim(), { description: "Phiếu chờ Quản lý Kho tổng duyệt và lập lệnh điều động; hàng đang được giữ chỗ tại kho xuất." });
            navigate(`/transfer-tickets/${res.id}`);
        } catch (e) {
            toast.error(getApiErrorMessage(e, "Không tạo được yêu cầu chuyển kho"));
        } finally {
            setLoading(false);
            dangTaoRef.current = false;
        }
    }

    // Ô số lượng có thể tạm trống khi đang gõ, không cộng chuỗi
    const totalQty = transferItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const khoXuat = warehouses.find(k => String(k.id) === String(formData.khoXuatId)) || null;
    const khoNhap = warehouses.find(k => String(k.id) === String(formData.khoNhapId)) || null;

    const lyDoKhoa = dangTai
        ? "Đang tải dữ liệu"
        : !formData.khoXuatId
        ? "Chọn kho nguồn"
        : !formData.khoNhapId
            ? "Chọn kho đích"
            : transferItems.length === 0
                ? "Thêm ít nhất một sản phẩm"
                : "";

    const doiChieu = () => setFormData(prev => {
        // Không phải quản trị viên: kho nguồn mới (kho đích cũ) phải là kho chọn được làm kho đích
        const nhanMoi = prev.khoXuatId;
        if (!toanTuyen && nhanMoi && !khoNhanDuoc.some(k => String(k.id) === String(nhanMoi))) {
            toast.warning("Không đổi chiều được: bạn chỉ tạo yêu cầu nhận hàng về kho mình phụ trách.");
            return prev;
        }
        return { ...prev, khoXuatId: prev.khoNhapId, khoNhapId: prev.khoXuatId };
    });

    // Tải lại riêng danh sách sản phẩm / kho (không đụng kho, hàng đã chọn)
    const taiLaiBienThe = async () => {
        try {
            const res = await donBanHangService.getVariantsForCreate();
            setVariants(res?.data?.data || res?.data || []);
            setLoiBienThe(null);
        } catch (e) {
            setLoiBienThe(moTaLoiBienThe(e));
        }
    };
    const taiLaiKho = async () => {
        try {
            setWarehouses(await taiKho());
            setLoiKho("");
        } catch (e) {
            setLoiKho(getApiErrorMessage(e, "máy chủ không phản hồi").trim().replace(/[.。]+$/, ""));
        }
    };

    const thongBao = [
        <DongThongBao key="nhap" tone="info">
            Tạo yêu cầu là <b className="font-semibold">giữ chỗ</b> số lượng tại kho xuất và gửi luôn cho Quản lý Kho tổng duyệt, lập lệnh điều động.
            Hàng chỉ rời kho khi kho xuất nhặt hàng và xác nhận xuất.
        </DongThongBao>,
        loiKho ? (
            <DongThongBao key="loi-kho" tone="bad" actions={<NutChu onClick={taiLaiKho}>Thử lại</NutChu>}>
                Không tải được danh sách kho: {loiKho}.
            </DongThongBao>
        ) : null,
        loiBienThe ? (
            <DongThongBao
                key="loi-bt"
                tone="bad"
                actions={loiBienThe.khongQuyen ? undefined : <NutChu onClick={taiLaiBienThe}>Thử lại</NutChu>}
            >
                Không tải được danh sách sản phẩm: {loiBienThe.chu}.
            </DongThongBao>
        ) : null,
    ].filter(Boolean);

    const timSanPham = (
        <div className="relative px-4 pb-3 pt-4 sm:px-6">
            <label htmlFor={`${idDs}-tim`} className="sr-only">Tìm hoặc quét sản phẩm</label>
            <ScanBarcode className="pointer-events-none absolute left-7 top-[26px] size-4 text-bo-muted sm:left-9" aria-hidden="true" />
            <input
                id={`${idDs}-tim`}
                ref={oTimRef}
                value={searchTerm}
                autoComplete="off"
                role="combobox"
                aria-expanded={moKetQua}
                aria-controls={`${idDs}-ds`}
                placeholder="Tìm tên, mã SKU hoặc quét mã vạch rồi Enter"
                onChange={(e) => { setSearchTerm(e.target.value); setMoKetQua(true); }}
                onFocus={() => setMoKetQua(true)}
                onBlur={() => setTimeout(() => setMoKetQua(false), 150)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleEnter(); }
                    else if (e.key === "Escape") setMoKetQua(false);
                }}
                className={cn(O_NHAP, "pl-9")}
            />
            {moKetQua ? (
                <div
                    id={`${idDs}-ds`}
                    role="listbox"
                    className="absolute inset-x-4 top-[calc(100%-6px)] z-30 max-h-[320px] overflow-y-auto rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg sm:inset-x-6"
                >
                    {filteredProducts.length ? filteredProducts.map((p) => {
                        const daCo = transferItems.find(i => i.variantId === p.id);
                        return (
                            <button
                                key={p.id}
                                type="button"
                                role="option"
                                aria-selected={false}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleAddProduct(p)}
                                className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left hover:bg-slate-100"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-bo-foreground">{p.tenSanPham}</span>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-bo-muted">
                                        <MauKichCo tenMau={p.tenMau} maMauHex={p.maMauHex} kichCo={p.tenSize} />
                                        <span className="font-mono">{p.maBienThe}</span>
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs text-bo-muted">{daCo ? `Đang có ${soVN(daCo.quantity)} · +1` : "Thêm"}</span>
                            </button>
                        );
                    }) : (
                        <p className="px-2.5 py-2 text-sm text-bo-muted">
                            {dangTai ? "Đang tải danh sách sản phẩm…" : loiBienThe ? "Chưa tải được danh sách sản phẩm." : variants.length ? "Không tìm thấy sản phẩm, thử tên hoặc mã khác." : "Chưa có sản phẩm đang kinh doanh nào."}
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );

    const doiSoLuong = (variantId, val) =>
        setTransferItems(prev => prev.map(it => it.variantId === variantId ? { ...it, quantity: val } : it));

    const cotBang = [
        {
            ma: "sl", nhan: "Số lượng", lop: "w-32 text-right",
            nhom: (n) => soVN(n.tong.soLuong),
            dong: (d) => (
                <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label={`Số lượng chuyển: ${d.tenSanPham} ${d.tenMau || ""} ${d.kichCo || ""}`.trim()}
                    value={d.oNhap}
                    onChange={(e) => {
                        let val = e.target.value;
                        // Chỉ parse khi có dữ liệu, nếu không để chuỗi rỗng để người dùng có thể xóa
                        if (val !== "") {
                            val = parseInt(val);
                            if (isNaN(val) || val < 1) val = 1;
                        }
                        doiSoLuong(d.id, val);
                    }}
                    onBlur={(e) => {
                        // Khi click chuột ra ngoài, nếu để trống thì reset về 1
                        if (e.target.value === "") doiSoLuong(d.id, 1);
                    }}
                    className={cn(O_NHAP, "ml-auto h-8 w-24 text-right font-semibold tabular-nums")}
                />
            ),
        },
        {
            ma: "bo", nhan: <span className="sr-only">Bỏ dòng</span>, lop: "w-14 text-right",
            dong: (d) => (
                <button
                    type="button"
                    onClick={() => {
                        // Còn ít dòng thì ô tìm trong bảng ẩn đi: bỏ từ khóa để không giấu dòng mà không có cách bỏ lọc
                        if (transferItems.length - 1 <= NGUONG_CONG_CU) bangHang.xoaTuKhoa();
                        setTransferItems(prev => prev.filter(it => it.variantId !== d.id));
                    }}
                    aria-label={`Bỏ ${d.tenSanPham} ${d.tenMau || ""} ${d.kichCo || ""}`.trim()}
                    title="Bỏ dòng"
                    className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-bo-danger-soft hover:text-bo-danger"
                >
                    <Trash2 className="size-4" aria-hidden="true" />
                </button>
            ),
        },
    ];

    const bang = transferItems.length === 0 ? (
        <EmptyState
            icon={Package}
            title="Chưa có sản phẩm nào"
            description="Gõ tên hoặc quét mã vạch ở ô phía trên. Quét lại cùng mã sẽ cộng thêm 1."
            className="min-h-[260px] flex-1"
        />
    ) : (
        <BangHangTaoPhieu bang={bangHang} cot={cotBang} dongSang={dongSang} tenChungTu="Phiếu chuyển kho" nhan="Hàng điều chuyển" rongToiThieu="@2xl/khoi:min-w-[480px]" />
    );

    const cotPhai = (
        <CotThuocTinh nhan="Thông tin phiếu chuyển">
            <NhomThuocTinh nhan="Tuyến chuyển">
                <ChonKho
                    vaiTro="Kho nguồn"
                    icon={Warehouse}
                    mau="bg-bo-primary-soft text-bo-primary"
                    kho={khoXuat}
                    dsKho={warehouses}
                    khoKhac={formData.khoNhapId}
                    onChon={(id) => setFormData(prev => ({ ...prev, khoXuatId: id }))}
                    goiYTrong={dangTai ? "Đang tải danh sách kho…" : loiKho ? "Chưa tải được danh sách kho." : "Không có kho nào đang hoạt động."}
                />
                <div className="flex h-[30px] items-center justify-between pl-4 text-slate-400">
                    <ArrowDown className="size-4" aria-hidden="true" />
                    {formData.khoXuatId && formData.khoNhapId ? (
                        <button
                            type="button"
                            onClick={doiChieu}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-bo-primary hover:bg-bo-primary-soft"
                        >
                            <ArrowUpDown className="size-3.5" aria-hidden="true" />
                            Đổi chiều
                        </button>
                    ) : null}
                </div>
                <ChonKho
                    vaiTro="Kho đích"
                    icon={Store}
                    mau="bg-bo-success-soft text-bo-success"
                    kho={khoNhap}
                    dsKho={khoNhanDuoc}
                    khoKhac={formData.khoXuatId}
                    onChon={(id) => setFormData(prev => ({ ...prev, khoNhapId: id }))}
                    goiYTrong={dangTai ? "Đang tải danh sách kho…" : loiKho ? "Chưa tải được danh sách kho." : "Bạn chưa được phân kho nào để nhận hàng."}
                />
                {!toanTuyen ? (
                    <p className="mt-2 text-xs leading-[18px] text-bo-muted">Bạn tạo yêu cầu nhận hàng về kho mình phụ trách.</p>
                ) : null}
            </NhomThuocTinh>
            <NhomThuocTinh>
                <label className="grid gap-1.5">
                    <span className={NHAN_O}>Ghi chú</span>
                    <textarea
                        value={formData.ghiChu}
                        maxLength={GHI_CHU_TOI_DA}
                        onChange={(e) => setFormData(prev => ({ ...prev, ghiChu: e.target.value.slice(0, GHI_CHU_TOI_DA) }))}
                        placeholder="Lý do điều phối hàng, vd. bổ sung hàng cho đợt khuyến mãi"
                        className={O_NHAP_NHIEU_DONG}
                    />
                    <span className={GOI_Y_O}>
                        <span>Không bắt buộc</span>
                        <span>{formData.ghiChu.length}/{GHI_CHU_TOI_DA}</span>
                    </span>
                </label>
            </NhomThuocTinh>
        </CotThuocTinh>
    );

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma="Tạo phiếu chuyển kho nội bộ"
                        dongPhu={[
                            // Tên hai kho đã ở cột Tuyến chuyển: không lặp ở dòng phụ
                            transferItems.length ? "" : "Chọn kho nguồn, kho đích và hàng cần chuyển",
                            transferItems.length ? `${soVN(bangHang.tong.soSanPham)} sản phẩm · ${soVN(bangHang.tong.soDong)} biến thể` : "",
                            transferItems.length ? `Tổng chuyển ${soVN(totalQty)}` : "",
                        ]}
                        onQuayLai={() => navigate("/transfer-tickets")}
                        nhanQuayLai="Quay lại danh sách"
                        nutChinh={{
                            ma: "tao",
                            nhan: "Tạo phiếu điều chuyển",
                            icon: Truck,
                            onClick: handleCreate,
                            khoa: Boolean(lyDoKhoa) || loading,
                            lyDo: lyDoKhoa || undefined,
                            hienLyDo: true,
                            dangChay: loading,
                        }}
                    />
                }
                tienTrinh={<TienTrinhChungTu buoc={BUOC} nhan="Các bước của phiếu chuyển kho" />}
                thongBao={thongBao}
                chinh={<>{timSanPham}{bang}</>}
                cotPhai={cotPhai}
            />
        </PageContainer>
    );
}
