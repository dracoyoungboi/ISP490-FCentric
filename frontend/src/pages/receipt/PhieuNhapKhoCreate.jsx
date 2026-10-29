import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown, FileText, Undo2 } from "lucide-react";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import purchaseOrderService from "@/services/purchaseOrderService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { donBanHangService } from "@/services/donBanHangService";
import { getMineKhoList } from "@/services/khoService";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";

import PageContainer from "@/components/backoffice/PageContainer";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import BangHangTaoPhieu from "@/components/chung-tu/BangHangTaoPhieu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN, tuBienThe } from "@/components/chung-tu/bangChungTu";
import { dongDonKemPhanGiu, donMuaCoPhieuNhap, noiSoPhieu, tinhPhanGiu } from "@/components/nhap-kho/phanGiuPhieuNhap";
import { GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { getKhoLamViecId, laKhoLamViecHopLe, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

/**
 * Tạo phiếu nhập kho (/goods-receipts/create): khối chứng từ "một khối" như các màn chi tiết.
 * Hai nguồn: đơn mua / phiếu xuất của đơn bị hoàn trả (cách lọc chứng từ được chọn, API tạo, "Lưu nháp" và "Tiếp tục
 * khai lô" cùng tạo phiếu một lần rồi mở chi tiết phiếu). Hàng chuyển kho nội bộ không nhập ở đây: kho nhận nhận hàng ở
 * màn phiếu chuyển (/transfer-tickets/:id/receive), máy chủ tự lập phiếu nhập PN-TRF / PN-RET (đặc tả BA); đường dẫn cũ
 * ?transferId= mở phiếu chuyển đó.
 *
 * Ghi chú: phần căn cứ ("Tạo phiếu nhập kho từ đơn mua …", "Nhập hoàn trả từ phiếu xuất: …") vẫn được ghi như cũ,
 * nhưng không hiện trong ô ghi chú (số chứng từ đã ở ô chọn). Phiếu nhập hoàn trả DỰA VÀO câu căn cứ chứa số phiếu
 * xuất để ẩn phiếu xuất đã nhập trả, nên câu căn cứ luôn được gửi kèm, người dùng không xóa được.
 */

const SOURCE_TABS = [
    { value: "PO", label: "Nhập từ đối tác", icon: FileText },
    { value: "RETURN", label: "Nhập hàng trả lại", icon: Undo2 },
];
const GHI_CHU_TOI_DA = 500;
const so = (x) => Number(x) || 0;
// Ô chọn gốc của trình duyệt nhưng bỏ mũi tên mặc định (Windows vẽ thành ô vuông), thay bằng ChevronDown như ô chọn khác
const O_CHON = cn(O_NHAP, "cursor-pointer appearance-none pr-9");
const TONG_BANG = Object.freeze({ soLuong: "soLuong", dat: "dat", daNhan: "daNhan", giu: "giu", con: "con", nhap: "nhap" });

/** Câu căn cứ ghi vào ghi chú phiếu (giữ đúng câu cũ). */
function cauCanCu(nguon, { po, px }) {
    if (nguon === "PO" && po) return `Tạo phiếu nhập kho từ đơn mua ${po.soDonMua}`;
    if (nguon === "RETURN" && px) return `Nhập hoàn trả từ phiếu xuất: ${px.soPhieuXuat} (Đơn: ${px.donBanHang?.soDonHang || "Không rõ"})`;
    return "";
}

/** Nhân viên / quản lý kho: máy chủ kiểm header kho_id là kho của phiếu → làm việc luôn ở kho nhận trước khi tạo. */
function lamViecTaiKho(khoId) {
    if (!khoId || hasAnyRole([ROLES.QUAN_TRI_VIEN])) return;
    if (getKhoLamViecId() === Number(khoId)) return;
    if (laKhoLamViecHopLe({ id: Number(khoId), trangThai: 1 })) setKhoLamViecId(Number(khoId));
}

export default function PhieuNhapKhoCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams(); // Đọc params từ URL

    // --- States cho Loại Nhập ---
    const [importSource, setImportSource] = useState("PO"); // "PO" hoặc "RETURN"

    // --- Data States ---
    const [poList, setPoList] = useState([]);
    const [returnList, setReturnList] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    const [selectedPO, setSelectedPO] = useState(null);
    // Phần các phiếu nhập Nháp của đơn đang chọn đang giữ (tinhPhanGiu); null khi chưa chọn đơn hoặc tải lỗi
    const [phanGiu, setPhanGiu] = useState(null);
    // Không tải được (một phần) phiếu nhập Nháp của đơn: "Còn lại" có thể chưa trừ hết phần đang giữ
    const [loiPhanGiu, setLoiPhanGiu] = useState(false);
    const [poCoPhieuNhap, setPoCoPhieuNhap] = useState(() => new Set());
    const [selectedReturn, setSelectedReturn] = useState(null);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [createdId, setCreatedId] = useState(null);
    // Khóa tạo phiếu: dangTaoRef chặn bấm đúp (state chỉ cập nhật ở lần render sau);
    // createdIdRef giữ id phiếu đã tạo để không bao giờ gọi API tạo lần 2.
    const dangTaoRef = useRef(false);
    const createdIdRef = useRef(null);

    const [form, setForm] = useState({
        donMuaHangId: "",
        phieuXuatId: "", // ID phiếu xuất kho dùng cho chức năng hoàn trả
        khoId: "",
    });
    // Ghi chú người dùng gõ thêm; câu căn cứ do hệ thống ghép khi gửi
    const [ghiChuThem, setGhiChuThem] = useState("");

    const handleSelectPO = useCallback(async (id) => {
        if (!id) {
            setSelectedPO(null);
            setPhanGiu(null);
            setLoiPhanGiu(false);
            setForm(prev => ({ ...prev, donMuaHangId: "" }));
            return;
        }
        setActionLoading(true);
        try {
            // Máy chủ trừ phần các phiếu nhập Nháp của đơn đang giữ khi tạo phiếu, nên "Còn lại" ở đây trừ đúng như vậy.
            // Không tải được phiếu nháp thì giữ cách tính cũ (Đặt − Đã nhận), máy chủ vẫn chặn nhập vượt.
            const [res, phieuGiu] = await Promise.all([
                purchaseOrderService.getById(id),
                phieuNhapKhoService.layPhieuGiuHangCuaDon(id).catch(() => null),
            ]);
            const data = res.data;
            const giu = phieuGiu ? tinhPhanGiu(phieuGiu.phieu) : null;
            data.chiTietDonMuaHangs = dongDonKemPhanGiu(data.chiTietDonMuaHangs, giu?.theoBienThe).map(item => ({
                ...item,
                maxSoLuong: item.conLai,
                soLuongNhapTay: item.conLai,
            }));
            setSelectedPO(data);
            setPhanGiu(giu);
            setLoiPhanGiu(!phieuGiu || phieuGiu.soLoi > 0);
            setForm(prev => ({
                ...prev,
                donMuaHangId: data.id,
                khoId: data.khoNhap?.id || prev.khoId,
            }));
        } catch {
            toast.error("Không thể tải chi tiết đơn mua hàng");
        } finally { setActionLoading(false); }
    }, []);

    const fetchInitialData = useCallback(async () => {
        // Đường dẫn cũ "Nhập kho" của phiếu chuyển: nay nhận hàng ở màn phiếu chuyển
        const urlTransferId = searchParams.get("transferId");
        if (/^\d+$/.test(urlTransferId ?? "")) {
            navigate(`/transfer-tickets/${urlTransferId}`, { replace: true });
            return;
        }
        setLoading(true);
        try {
            const myWarehousesRes = await getMineKhoList().catch(() => ({ data: [] }));
            const warehouseList = myWarehousesRes.data || myWarehousesRes || [];
            setWarehouses(warehouseList);
            const myWarehouseIds = warehouseList.map(w => w.id);

            const [poRes, allReceiptsRes, allIssuesRes, returnSoRes] = await Promise.all([
                purchaseOrderService.filter({
                    page: 0, size: 1000,
                    filters: [{ fieldName: "trangThai", operator: "IN", value: [3, 5] }],
                    sorts: [{ fieldName: "id", direction: "DESC" }]
                }).catch(() => ({ content: [] })),

                // Mới nhất trước: quá 2000 phiếu thì phần bị cắt là phiếu cũ (phiếu nháp và phiếu chuyển đang chờ là phiếu mới)
                phieuNhapKhoService.filter({ page: 0, size: 2000, sorts: [{ fieldName: "id", direction: "DESC" }] }).catch(() => ({ content: [] })),

                phieuXuatKhoService.filter({ page: 0, size: 2000 }).catch(() => ({ content: [] })),

                // Fetch các Đơn Bán Hàng trạng thái 6 (Bị hoàn trả) để tham chiếu
                donBanHangService.filter({
                    page: 0, size: 1000,
                    filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 6 }],
                    sorts: [{ fieldName: "ngayCapNhat", direction: "DESC" }]
                }).catch(() => ({ content: [] }))
            ]);

            // === 1. XỬ LÝ PO (Logic nguyên gốc) ===
            const rawPoList = poRes.data?.content || poRes.content || [];
            const validPoList = rawPoList.filter(po => {
                if (po.trangThai !== 3 && po.trangThai !== 5) return false;
                const targetKhoId = po.khoNhap?.id || po.khoNhapId;
                if (!targetKhoId) return false;

                const isMyWarehouse = myWarehouseIds.map(Number).includes(Number(targetKhoId));
                if (!isMyWarehouse) return false;
                if (po.chiTietDonMuaHangs && Array.isArray(po.chiTietDonMuaHangs)) {
                    return po.chiTietDonMuaHangs.some(ct => (ct.soLuongDaNhan || 0) < (ct.soLuongDat || 0));
                }

                return true;
            });
            setPoList(validPoList);

            const allReceipts = allReceiptsRes.content || allReceiptsRes.data?.content || [];
            setPoCoPhieuNhap(donMuaCoPhieuNhap(allReceipts));
            const allIssues = allIssuesRes.content || allIssuesRes.data?.content || [];

            // === 2. Lọc phiếu xuất thuộc đơn hàng bị hoàn trả
            const rawReturnSOs = returnSoRes.content || returnSoRes.data?.content || [];
            const returnedSOIds = new Set(rawReturnSOs.map(don => Number(don.id)));

            // Lọc ra các Phiếu nhập hoàn trả đang TỒN TẠI (Trạng thái khác 4 - Đã hủy)
            const activeReturnReceipts = allReceipts.filter(r =>
                r.trangThai !== 4 &&
                (r.soPhieuNhap?.includes("-RET-") || (r.loaiNhap || "").toLowerCase().includes("hoàn trả"))
            );

            const availableReturnPXs = allIssues.filter(px => {
                if (px.trangThai !== 3) return false; // Phải là phiếu đã xuất thành công
                if (!px.donBanHang || !returnedSOIds.has(Number(px.donBanHang.id))) return false; // Phải thuộc Đơn bán hàng bị hoàn trả

                // Kho xuất đi phải là kho thuộc quyền quản lý của nhân viên (để trả về đúng kho)
                const targetKhoId = px.kho?.id || px.khoXuatId;
                if (!targetKhoId || !myWarehouseIds.map(Number).includes(Number(targetKhoId))) return false;

                // Kiểm tra xem phiếu xuất này đã bị lấy đi tạo Phiếu nhập hoàn trả nào chưa (dựa vào ghi chú chứa mã phiếu xuất)
                const isAlreadyReturned = activeReturnReceipts.some(receipt =>
                    receipt.ghiChu?.includes(px.soPhieuXuat)
                );
                if (isAlreadyReturned) return false; // Nếu đã có phiếu nhập -> Ẩn khỏi dropdown

                return true;
            });
            setReturnList(availableReturnPXs);

            if (warehouseList.length === 1) {
                setForm(prev => ({ ...prev, khoId: warehouseList[0].id }));
            }

            // === URL PARAMS AUTO SELECT ===
            const urlPoId = searchParams.get("poId");

            if (urlPoId) {
                // Tìm trong danh sách hợp lệ xem có PO này không
                const poInList = validPoList.find(p => String(p.id) === String(urlPoId));
                if (poInList) {
                    // Gọi hàm handleSelectPO để load chi tiết và set selectedPO
                    await handleSelectPO(urlPoId);
                } else {
                    toast.warning("Đơn mua này không đủ điều kiện để nhập kho hoặc bạn không có quyền");
                }
            }

        } catch {
            toast.error("Không thể tải dữ liệu khởi tạo");
        } finally {
            setLoading(false);
        }
    }, [searchParams, handleSelectPO, navigate]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu khởi tạo vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => fetchInitialData());
    }, [fetchInitialData]);

    const handleQuantityChange = (chiTietId, newValue) => {
        setSelectedPO(prev => {
            if (!prev) return prev;

            const updatedItems = prev.chiTietDonMuaHangs.map(ct => {
                if (ct.id === chiTietId) {
                    let finalValue = newValue;
                    if (newValue !== "") {
                        finalValue = parseInt(newValue, 10);
                        if (isNaN(finalValue) || finalValue < 0) finalValue = 0;
                        if (finalValue > ct.maxSoLuong) finalValue = ct.maxSoLuong;
                    }

                    return { ...ct, soLuongNhapTay: finalValue };
                }
                return ct;
            });

            return { ...prev, chiTietDonMuaHangs: updatedItems };
        });
    };

    // Bổ sung handler khi chọn Phiếu Xuất trả lại
    const handleSelectReturn = useCallback(async (id) => {
        if (!id) {
            setSelectedReturn(null);
            setForm(prev => ({ ...prev, phieuXuatId: "" })); // Reset form khi bỏ chọn
            return;
        }
        setActionLoading(true);
        try {
            const res = await phieuXuatKhoService.getDetail(id);
            const data = res.data || res;

            setSelectedReturn(data); // Lưu nguyên vẹn để dùng cho việc map danh sách chi tiết
            const selectedItem = returnList.find(px => String(px.id) === String(id));

            setForm(prev => ({
                ...prev,
                phieuXuatId: id, // Lấy cứng ID truyền vào luôn, không sợ undefined
                khoId: selectedItem?.kho?.id || selectedItem?.khoXuatId || prev.khoId,
            }));
        } catch {
            toast.error("Không thể tải chi tiết phiếu xuất");
        } finally { setActionLoading(false); }
    }, [returnList]);

    const pxTraDangChon = returnList.find(px => String(px.id) === String(form.phieuXuatId)) || null;
    const canCu = cauCanCu(importSource, { po: selectedPO, px: pxTraDangChon });
    const ghiChuGui = [canCu, ghiChuThem.trim()].filter(Boolean).join(". ");
    // Kho nhận theo ĐÚNG nguồn đang chọn (hai nguồn không dùng chung một kho, kẻo đổi tab rồi tạo nhầm kho làm việc)
    const khoMotKho = warehouses.length === 1 ? warehouses[0].id : null;
    const khoNhanId = importSource === "PO"
        ? (selectedPO ? selectedPO.khoNhap?.id ?? khoMotKho : null)
        : (pxTraDangChon ? pxTraDangChon.kho?.id ?? pxTraDangChon.khoXuatId ?? khoMotKho : null);

    // Trả về id phiếu (đã có hoặc vừa tạo); null nếu chưa tạo được hoặc đang tạo dở
    async function createPhieu() {
        if (createdIdRef.current) return createdIdRef.current;
        if (dangTaoRef.current) return null;
        dangTaoRef.current = true;
        try {
            const newId = await taoPhieuMoi();
            if (newId) {
                createdIdRef.current = newId;
                setCreatedId(newId);
            }
            return newId;
        } finally {
            dangTaoRef.current = false;
        }
    }

    async function taoPhieuMoi() {
        lamViecTaiKho(khoNhanId);
        if (importSource === "PO") {
            if (!selectedPO) return toast.error("Vui lòng chọn đơn mua hàng"), null;
            const chiTiet = selectedPO.chiTietDonMuaHangs.map(ct => ({
                bienTheSanPhamId: ct.bienTheSanPham.id,
                soLuongDuKienNhap: Number(ct.soLuongNhapTay) || 0
            })).filter(ct => ct.soLuongDuKienNhap > 0);
            if (!chiTiet.length) return toast.error("Nhập số lượng cho ít nhất một mặt hàng"), null;

            try {
                setActionLoading(true);
                const res = await phieuNhapKhoService.create({
                    donMuaHangId: selectedPO.id,
                    ghiChu: ghiChuGui,
                    chiTietPhieuNhapKhos: chiTiet
                });
                toast.success("Tạo phiếu nhập thành công");
                return res.id;
            } catch (e) {
                toast.error(e?.response?.data?.message || "Lỗi khi tạo phiếu nhập");
                return null;
            } finally { setActionLoading(false); }
        } else if (importSource === "RETURN") {
            if (!form.phieuXuatId) return toast.error("Vui lòng chọn phiếu xuất của đơn hàng cần hoàn trả"), null;
            try {
                setActionLoading(true);
                const res = await phieuNhapKhoService.createFromSalesReturn(form.phieuXuatId, { ghiChu: ghiChuGui });
                const newId = res.data?.data?.id ?? res.data?.id ?? res.id;
                toast.success("Khởi tạo phiếu nhập trả hàng thành công");
                return newId;
            } catch (e) {
                toast.error(e?.response?.data?.message || "Không thể tạo phiếu nhập hoàn trả");
                return null;
            } finally { setActionLoading(false); }
        }
        return null;
    }

    // "Lưu nháp" và "Tiếp tục khai lô" cùng tạo phiếu (một lần) rồi mở chi tiết phiếu vừa tạo
    // — ở đó khai báo lô / hủy phiếu. Phiếu đã tạo thì chỉ mở lại, không tạo thêm.
    const handleContinue = async () => {
        const id = await createPhieu();
        if (id) navigate(`/goods-receipts/${id}`);
    };

    // ── Dòng bảng hàng (dạng dòng chứng từ của bangChungTu.js) — gom theo sản phẩm, tìm, phân trang như màn chi tiết ──
    const dongBang = useMemo(() => {
        if (importSource === "PO") {
            return (selectedPO?.chiTietDonMuaHangs || []).map(ct => ({
                ...tuBienThe(ct.bienTheSanPham),
                id: ct.id,
                bienTheId: ct.bienTheSanPham?.id ?? null,
                dat: so(ct.soLuongDat),
                daNhan: so(ct.soLuongDaNhan),
                giu: so(ct.dangGiu),
                thieu: so(ct.thieu),
                con: so(ct.maxSoLuong),
                nhap: so(ct.soLuongNhapTay),
                oNhap: ct.soLuongNhapTay,
            }));
        }
        const dsTra = selectedReturn?.chiTiet || selectedReturn?.chiTietPhieuXuatKhos || [];
        return dsTra.map((item, i) => {
            const bt = tuBienThe(item.bienTheSanPham);
            return {
                ...bt,
                id: item.id ?? `tra-${i}`,
                // Chi tiết phiếu xuất (ChiTietPhieuXuatKhoDto) trả trường phẳng; máy chủ cũ chỉ có tenBienThe "Tên / Màu"
                khoaNhom: item.sanPhamId ?? bt.khoaNhom,
                tenSanPham: item.tenSanPham || item.tenBienThe || bt.tenSanPham || item.bienTheSanPham?.sanPham?.tenSanPham || "",
                sku: item.sku || bt.sku,
                tenMau: item.tenMau || bt.tenMau,
                maMauHex: item.maMauHex || bt.maMauHex,
                kichCo: item.kichCo || bt.kichCo,
                anh: item.anh || bt.anh,
                soLuong: so(item.soLuongCanXuat || item.soLuong),
            };
        });
    }, [importSource, selectedPO, selectedReturn]);
    const bangHang = useBangChungTu(dongBang, { tongTheo: TONG_BANG });
    const tongNhapPO = bangHang.tong.nhap;
    const tongConPO = bangHang.tong.con;
    // Các phiếu nhập Nháp đang giữ hàng của đơn đang chọn
    const dsPhieuGiu = importSource === "PO" && selectedPO ? (phanGiu?.phieu ?? []) : [];
    const coPhieuGiu = dsPhieuGiu.length > 0;

    if (loading) {
        return (
            <PageContainer>
                <LoadingState rows={4} label="Đang tải dữ liệu khởi tạo" />
            </PageContainer>
        );
    }

    const tenKhoNhan =
        (importSource === "PO" && selectedPO?.khoNhap?.tenKho) ||
        (importSource === "RETURN" && (pxTraDangChon?.kho?.tenKho)) ||
        warehouses.find(k => String(k.id) === String(khoNhanId))?.tenKho ||
        "";

    const noSourceSelected =
        (importSource === "PO" && !selectedPO) ||
        (importSource === "RETURN" && !selectedReturn);

    const lyDoKhoa = actionLoading
        ? ""
        : noSourceSelected
            ? (importSource === "PO" ? "Chọn đơn mua hàng" : "Chọn phiếu xuất cần nhập trả")
            : !khoNhanId
                ? "Chưa xác định được kho nhận"
                : importSource === "PO" && tongConPO === 0 && coPhieuGiu
                    ? `Phần còn lại đã nằm ở phiếu nháp ${noiSoPhieu(dsPhieuGiu)}`
                    : importSource === "PO" && tongNhapPO === 0
                        ? "Nhập số lượng cho ít nhất một mặt hàng"
                        : "";
    const khoaTao = Boolean(lyDoKhoa) || actionLoading;

    const nhanNutChinh = importSource === "PO" ? "Tiếp tục khai lô" : "Xác nhận nhập kho";
    const iconNutChinh = importSource === "PO" ? ArrowRight : Undo2;

    const dauDongPhu = tenKhoNhan ? `Nhập vào ${tenKhoNhan}` : "Chọn chứng từ nguồn để bắt đầu";
    // Tổng của cả phiếu nằm ở dòng phụ đầu khối (như các màn chi tiết), không lặp ở chân bảng
    const dongPhu = noSourceSelected ? dauDongPhu : [
        dauDongPhu,
        `${soVN(bangHang.tong.soSanPham)} sản phẩm · ${soVN(bangHang.tong.soDong)} biến thể`,
        importSource === "PO" ? `Nhập lần này ${soVN(tongNhapPO)}/${soVN(tongConPO)}` : `Tổng ${soVN(bangHang.tong.soLuong)}`,
    ];

    // ── Thông báo ──
    const thongBao = [];
    if (importSource === "PO" && selectedPO && loiPhanGiu) {
        thongBao.push(
            <DongThongBao key="loi-phieu-giu" tone="warn">
                Chưa tải được đủ phiếu nhập nháp của đơn này nên "Còn lại" có thể chưa trừ phần các phiếu đó đang giữ. Máy chủ vẫn kiểm lại khi tạo phiếu.
            </DongThongBao>
        );
    }
    if (coPhieuGiu) {
        const nhieuPhieu = dsPhieuGiu.length > 1;
        // Phiếu tạo trước khi máy chủ trừ phần giữ có thể giữ trùng nhau: xét từng biến thể (tổng cả đơn có thể vẫn nhỏ
        // hơn số còn thiếu dù một biến thể đã bị giữ quá số, phiếu đó sẽ bị chặn khi nhập kho)
        const dongGiuThua = dongBang.filter(d => d.giu > d.thieu);
        const giuThua = dongGiuThua.length > 0;
        const viDuGiuThua = dongGiuThua.slice(0, 2).map(d => d.sku).filter(Boolean).join(", ")
            + (dongGiuThua.length > 2 ? ` và ${soVN(dongGiuThua.length - 2)} biến thể khác` : "");
        // Chỉ ra đúng các phiếu đang giữ biến thể bị giữ thừa (phiếu khác có thể đang giữ hợp lệ)
        const idGiuThua = new Set(dongGiuThua.map(d => Number(d.bienTheId)));
        const phieuGiuThua = dsPhieuGiu.filter(p => (p.bienThe ?? []).some(id => idGiuThua.has(id)));
        thongBao.push(
            <DongThongBao
                key="phieu-giu"
                tone="warn"
                actions={dsPhieuGiu.slice(0, 3).map(p => (
                    <NutChu
                        key={p.id}
                        onClick={() => {
                            // Kiểm đếm trên phiếu cần làm việc ở kho nhận của đơn, như lúc tạo phiếu
                            lamViecTaiKho(khoNhanId);
                            navigate(`/goods-receipts/${p.id}`);
                        }}
                    >
                        Mở {p.soPhieuNhap}
                    </NutChu>
                ))}
            >
                Đơn này đang có phiếu nhập nháp <b className="font-semibold">{noiSoPhieu(dsPhieuGiu)}</b> giữ số lượng {soVN(bangHang.tong.giu)}.
                {giuThua
                    ? phieuGiuThua.length > 1
                        ? ` Phiếu ${noiSoPhieu(phieuGiuThua)} cùng giữ nhiều hơn số đơn còn thiếu ở ${soVN(dongGiuThua.length)} biến thể (${viDuGiuThua}): kiểm đếm trên một phiếu, hủy phiếu thừa.`
                        : ` Phiếu ${noiSoPhieu(phieuGiuThua)} giữ nhiều hơn số đơn còn thiếu ở ${soVN(dongGiuThua.length)} biến thể (${viDuGiuThua}) nên sẽ bị chặn khi nhập kho: hủy phiếu đó rồi tạo lại theo số còn thiếu.`
                    : tongConPO > 0
                        ? ` Kiểm đếm tiếp trên ${nhieuPhieu ? "các phiếu" : "phiếu"} đó. Phiếu mới chỉ nhận phần chưa có phiếu nào giữ.`
                        : ` Kiểm đếm tiếp trên ${nhieuPhieu ? "các phiếu" : "phiếu"} đó, không cần tạo phiếu mới.`}
            </DongThongBao>
        );
    }
    if (importSource === "PO" && selectedPO && tongNhapPO > 0 && tongNhapPO < tongConPO) {
        thongBao.push(
            <DongThongBao key="mot-phan" tone="info">
                Đang nhập một phần đơn mua. Phần còn lại vẫn chờ ở đơn mua, nhập ở phiếu sau.
            </DongThongBao>
        );
    }
    if (importSource === "RETURN" && selectedReturn) {
        thongBao.push(
            <DongThongBao key="tra" tone="info">
                Hàng trả được nhập lại đúng các lô đã xuất, đủ số lượng trên phiếu xuất. Phiếu tạo ở trạng thái nháp để kiểm lại trước khi nhập.
            </DongThongBao>
        );
    }

    // ── Chọn nguồn + chứng từ ──
    const chonNguon = (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-bo-border px-4 py-4 sm:px-6">
            <div className="grid gap-1.5">
                <span className={NHAN_O}>Nguồn nhập</span>
                <NutPhanDoan
                    nhan="Nguồn nhập"
                    value={importSource}
                    onChange={(v) => { setImportSource(v); bangHang.xoaTuKhoa(); }}
                    luaChon={SOURCE_TABS.map(t => ({
                        value: t.value,
                        label: t.label,
                        count: t.value === "PO" ? poList.length : returnList.length,
                    }))}
                />
            </div>
            <label className="relative grid w-full min-w-0 gap-1.5 sm:w-[440px]">
                <span className={NHAN_O}>
                    {importSource === "PO" ? "Đơn mua hàng" : "Phiếu xuất của đơn bị hoàn trả"}
                    {" "}<span className="text-bo-danger">*</span>
                </span>
                {importSource === "PO" && (
                    <select className={O_CHON} value={form.donMuaHangId} disabled={actionLoading} onChange={(e) => { bangHang.xoaTuKhoa(); handleSelectPO(e.target.value); }}>
                        <option value="">{poList.length ? "Chọn đơn mua đang chờ nhận hàng" : "Không có đơn mua nào chờ nhận hàng"}</option>
                        {poList.map(po => (
                            <option key={po.id} value={po.id}>
                                {po.soDonMua} · {po.nhaCungCap?.tenNhaCungCap}{poCoPhieuNhap.has(Number(po.id)) ? " · có phiếu nháp" : ""}
                            </option>
                        ))}
                    </select>
                )}
                {importSource === "RETURN" && (
                    <select className={O_CHON} value={form.phieuXuatId} disabled={actionLoading} onChange={(e) => { bangHang.xoaTuKhoa(); handleSelectReturn(e.target.value); }}>
                        <option value="">{returnList.length ? "Chọn phiếu xuất" : "Không có phiếu xuất nào chờ nhập trả"}</option>
                        {returnList.map(px => (
                            <option key={px.id} value={px.id}>
                                {px.soPhieuXuat} · đơn {px.donBanHang?.soDonHang}
                            </option>
                        ))}
                    </select>
                )}
                <ChevronDown className="pointer-events-none absolute bottom-2.5 right-3 size-4 text-bo-muted" aria-hidden="true" />
            </label>
        </div>
    );

    // ── Bảng hàng ──
    const cotBang = importSource === "PO"
        ? [
            {
                ma: "dat", nhan: "Đặt", lop: "w-20 text-right", anHep: true, nhom: (n) => soVN(n.tong.dat), dong: (d) => soVN(d.dat),
                // Khối hẹp: các cột Đặt / Đã nhận / Phiếu nháp giữ ẩn → ghi dưới tên biến thể
                phuHep: (d) => `Đặt ${soVN(d.dat)} · đã nhận ${soVN(d.daNhan)}${d.giu > 0 ? ` · phiếu nháp giữ ${soVN(d.giu)}` : ""}`,
            },
            { ma: "daNhan", nhan: "Đã nhận", lop: "w-20 text-right", anHep: true, nhom: (n) => soVN(n.tong.daNhan), dong: (d) => soVN(d.daNhan) },
            // Chỉ khi đơn có phiếu nhập Nháp giữ hàng
            ...(coPhieuGiu ? [{
                ma: "giu", nhan: "Phiếu nháp giữ", lop: "w-28 text-right", anHep: true,
                nhom: (n) => soVN(n.tong.giu),
                dong: (d) => (d.giu > 0 ? soVN(d.giu) : <span className="text-bo-muted">0</span>),
            }] : []),
            {
                ma: "con", nhan: "Còn lại", lop: "w-20 text-right",
                nhom: (n) => soVN(n.tong.con),
                // Hết phần còn lại vì phiếu nháp đang giữ: ghi 0, không ghi "Đủ" (đơn chưa nhận đủ)
                dong: (d) => (d.con > 0
                    ? soVN(d.con)
                    : d.thieu > 0 ? <span className="text-bo-muted">0</span> : <span className="text-bo-success">Đủ</span>),
            },
            {
                ma: "nhap", nhan: "Nhập lần này", lop: "w-32 text-right",
                nhom: (n) => soVN(n.tong.nhap),
                dong: (d) => (d.con > 0 ? (
                    <input
                        type="number"
                        min="0"
                        max={d.con}
                        inputMode="numeric"
                        aria-label={`Nhập lần này: ${d.tenSanPham} ${d.tenMau || ""} ${d.kichCo || ""}`.trim()}
                        className={cn(O_NHAP, "ml-auto h-8 w-24 text-right font-semibold tabular-nums")}
                        value={d.oNhap}
                        onChange={(e) => handleQuantityChange(d.id, e.target.value)}
                    />
                ) : <span className="text-bo-muted">—</span>),
            },
        ]
        : [{ ma: "sl", nhan: "Số lượng trả", lop: "w-36 text-right", nhom: (n) => soVN(n.tong.soLuong), dong: (d) => soVN(d.soLuong) }];

    const bang = noSourceSelected ? (
        <EmptyState
            icon={importSource === "PO" ? FileText : Undo2}
            title={importSource === "PO" ? "Chưa chọn đơn mua hàng" : "Chưa chọn phiếu xuất"}
            description={
                importSource === "PO"
                    ? "Chỉ hiện đơn mua về kho của bạn và còn hàng chưa nhận. Hàng chuyển kho nội bộ nhận ở màn phiếu chuyển kho."
                    : "Chỉ hiện phiếu xuất đã giao của đơn bán bị hoàn trả và chưa nhập trả."
            }
            className="min-h-[280px] flex-1"
        />
    ) : (
        <BangHangTaoPhieu
            bang={bangHang}
            cot={cotBang}
            tenChungTu={importSource === "PO" ? "Đơn mua hàng" : "Phiếu xuất"}
            nhan={importSource === "PO" ? "Hàng trong đơn mua" : "Hàng khách trả"}
            rongToiThieu={importSource === "PO" ? (coPhieuGiu ? "@2xl/khoi:min-w-[730px]" : "@2xl/khoi:min-w-[620px]") : "@2xl/khoi:min-w-[460px]"}
        />
    );

    // ── Cột thuộc tính ──
    const oGhiChu = (
        <NhomThuocTinh>
            <label className="grid gap-1.5">
                <span className={NHAN_O}>Ghi chú</span>
                <textarea
                    value={ghiChuThem}
                    maxLength={GHI_CHU_TOI_DA}
                    onChange={(e) => setGhiChuThem(e.target.value.slice(0, GHI_CHU_TOI_DA))}
                    placeholder={importSource === "PO" ? "Ví dụ: Giao thiếu 1 thùng, nhà cung cấp hẹn bù" : "Ví dụ: Khách đổi ý, hàng còn nguyên tem"}
                    className={O_NHAP_NHIEU_DONG}
                />
                <span className={GOI_Y_O}>
                    <span>Số chứng từ nguồn được ghi kèm tự động</span>
                    <span>{ghiChuThem.length}/{GHI_CHU_TOI_DA}</span>
                </span>
            </label>
        </NhomThuocTinh>
    );

    let cotPhai = null;
    if (!noSourceSelected) {
        cotPhai = (
            <CotThuocTinh nhan="Thông tin phiếu nhập">
                {importSource === "PO" && (
                    <NhomThuocTinh nhan="Nhà cung cấp">
                        <div className="text-sm font-semibold text-bo-foreground">{selectedPO.nhaCungCap?.tenNhaCungCap || "—"}</div>
                        {selectedPO.nhaCungCap?.maNhaCungCap ? (
                            <div className="mt-0.5 font-mono text-xs text-bo-muted">{selectedPO.nhaCungCap.maNhaCungCap}</div>
                        ) : null}
                    </NhomThuocTinh>
                )}
                {importSource === "RETURN" && (
                    <NhomThuocTinh nhan="Đơn bị hoàn trả">
                        <BangThuocTinh
                            muc={[
                                { nhan: "Đơn bán hàng", giaTri: pxTraDangChon?.donBanHang?.soDonHang },
                                { nhan: "Khách hàng", giaTri: pxTraDangChon?.donBanHang?.khachHang?.tenKhachHang, an: !pxTraDangChon?.donBanHang?.khachHang?.tenKhachHang },
                            ]}
                        />
                    </NhomThuocTinh>
                )}
                {oGhiChu}
            </CotThuocTinh>
        );
    }

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma="Tạo phiếu nhập kho"
                        dongPhu={dongPhu}
                        onQuayLai={() => navigate("/goods-receipts")}
                        nhanQuayLai="Quay lại danh sách"
                        nutPhu={{
                            ma: "nhap",
                            nhan: "Lưu nháp",
                            onClick: handleContinue,
                            khoa: khoaTao || Boolean(createdId),
                        }}
                        nutChinh={{
                            ma: "tao",
                            nhan: nhanNutChinh,
                            icon: iconNutChinh,
                            onClick: handleContinue,
                            khoa: khoaTao,
                            lyDo: lyDoKhoa || undefined,
                            hienLyDo: true,
                            dangChay: actionLoading,
                        }}
                    />
                }
                tienTrinh={chonNguon}
                thongBao={thongBao.length ? thongBao : null}
                chinh={bang}
                cotPhai={cotPhai}
            />
        </PageContainer>
    );
}
