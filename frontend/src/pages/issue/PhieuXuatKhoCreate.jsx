import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown, Package } from "lucide-react";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { getMineKhoList } from "@/services/khoService";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import TuyenChuyen from "@/components/chung-tu/TuyenChuyen";
import BangHangTaoPhieu from "@/components/chung-tu/BangHangTaoPhieu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { NHAN_O, O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { dongChuyenKho } from "@/components/chuyen-kho/tinhChuyenKho";
import { getKhoLamViecId, laKhoLamViecHopLe, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Ô chọn gốc của trình duyệt nhưng bỏ mũi tên mặc định (Windows vẽ thành ô vuông), thay bằng ChevronDown
const O_CHON = cn(O_NHAP, "cursor-pointer appearance-none pr-9");

/** Ngày giờ ngắn "15:37 · 23/10/2026" theo giờ máy người dùng. */
function ngayGio(giaTri) {
    if (!giaTri) return "";
    const d = new Date(giaTri);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Nhân viên / quản lý kho: máy chủ kiểm header kho_id là kho của phiếu → làm việc luôn ở kho xuất trước khi tạo. */
function lamViecTaiKho(khoId) {
    if (!khoId || hasAnyRole([ROLES.QUAN_TRI_VIEN])) return;
    if (getKhoLamViecId() === Number(khoId)) return;
    if (laKhoLamViecHopLe({ id: Number(khoId), trangThai: 1 })) setKhoLamViecId(Number(khoId));
}

/**
 * Tạo phiếu xuất CHUYỂN KHO từ yêu cầu chuyển kho đã duyệt (/goods-issues/create?transferId=). Phiếu xuất bán hàng không
 * tạo ở đây: hệ thống sinh khi hoàn tất nhặt hàng (có sẵn lô của phiếu nhặt); phiếu bị hủy sau khi nhặt thì "Tạo lại
 * phiếu xuất" ở màn đơn bán. Khối chứng từ "một khối" như các màn tạo / chi tiết khác.
 *
 * Nghiệp vụ giữ như cũ: danh sách = phiếu chuyển trạng thái 2 (đã duyệt) của kho mình, chưa có phiếu xuất còn hiệu lực;
 * POST /phieu-chuyen-kho/{id}/create-export. "Tạo phiếu" tạo rồi ở lại, "Tiếp tục bốc lô" tạo (nếu chưa) rồi mở phiếu.
 * Phiếu đã tạo gắn với đúng yêu cầu đã chọn: đổi yêu cầu khác thì không mở nhầm phiếu cũ, cũng không tạo lần 2.
 */
export default function PhieuXuatKhoCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams(); // Lấy query param từ URL

    const [transferList, setTransferList] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedTransfer, setSelectedTransfer] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dangTai, setDangTai] = useState(true);
    const [dangTaiPhieu, setDangTaiPhieu] = useState(false);
    const [loiTai, setLoiTai] = useState(false);
    // Phiếu xuất đã tạo theo từng yêu cầu chuyển: { [transferId]: phieuXuatId }
    const [daTao, setDaTao] = useState({});
    const dangTaoRef = useRef(false);
    const [form, setForm] = useState({ transferId: "", khoId: "" });

    const handleSelectTransfer = useCallback(async (transferId) => {
        if (!transferId) {
            setSelectedTransfer(null);
            setForm((prev) => ({ ...prev, transferId: "" }));
            return;
        }
        setDangTaiPhieu(true);
        try {
            const res = await phieuChuyenKhoService.getDetail(transferId);
            const data = res.data || res;
            setSelectedTransfer(data);
            setForm(prev => ({ ...prev, transferId: data.id, khoId: data.khoXuatId }));
        } catch {
            toast.error("Không thể tải chi tiết yêu cầu chuyển kho");
        } finally {
            setDangTaiPhieu(false);
        }
    }, []);

    const fetchInitialData = useCallback(async () => {
        setDangTai(true);
        setLoiTai(false);
        try {
            const myWarehousesRes = await getMineKhoList();
            const warehouseList = myWarehousesRes.data || myWarehousesRes;
            setWarehouses(warehouseList);
            const myWarehouseIds = warehouseList.map(w => w.id);

            // 1. Tải danh sách Phiếu Chuyển Kho đã duyệt
            const transferRes = await phieuChuyenKhoService.filter({
                page: 0, size: 1000,
                filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 2 }],
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
            });

            // 2. Tải danh sách Phiếu Xuất Kho (Bỏ filter NOT_IN để tránh lỗi Backend)
            const exportsRes = await phieuXuatKhoService.filter({
                page: 0, size: 10000
            });

            const allExportsRaw = exportsRes.content || exportsRes.data?.content || [];

            // Lọc bỏ các phiếu đã hủy (trạng thái = 4) bằng JavaScript
            const allExports = allExportsRaw.filter(pxk => pxk.trangThai !== 4);

            // Trích xuất ra mảng ID của các phiếu chuyển đã được tạo phiếu xuất
            const usedTransferIds = allExports
                .map(pxk => pxk.phieuChuyenKhoGocId)
                .filter(Boolean); // Lọc bỏ null/undefined

            // 3. Lọc phiếu chuyển kho
            const allTransfers = transferRes.content || transferRes.data?.content || [];
            const validTransfers = allTransfers.filter(t => {
                const idKhoXuat = t.kho?.id;
                if (!idKhoXuat) return false;

                // Điều kiện 1: Thuộc kho của tôi
                const isMyWarehouse = myWarehouseIds.map(Number).includes(Number(idKhoXuat));

                // Điều kiện 2: Chưa bị tạo phiếu xuất trước đó (ID không nằm trong mảng usedTransferIds)
                const isNotDuplicated = !usedTransferIds.includes(t.id);

                return isMyWarehouse && isNotDuplicated;
            });

            setTransferList(validTransfers);

            if (warehouseList.length === 1)
                setForm(prev => ({ ...prev, khoId: warehouseList[0].id }));

            // Liên kết cũ "?soId=" (tạo phiếu xuất bán hàng tay) không còn dùng
            if (searchParams.get("soId")) {
                toast.info("Phiếu xuất bán hàng được tạo tự động khi hoàn tất nhặt hàng. Gom đơn vào phiếu nhặt ở màn Đơn chờ xuất.");
            }

            // auto-fill nếu có param transferId TỪ URL
            const urlTransferId = searchParams.get("transferId");
            if (urlTransferId) {
                const isTransferValid = validTransfers.some(t => String(t.id) === String(urlTransferId));
                if (isTransferValid) {
                    await handleSelectTransfer(urlTransferId);
                } else {
                    toast.warning("Yêu cầu chuyển kho này không đủ điều kiện xuất kho hoặc bạn không có quyền");
                }
            }

        } catch {
            toast.error("Không thể tải dữ liệu khởi tạo");
            setLoiTai(true);
        } finally {
            setDangTai(false);
        }
    }, [searchParams, handleSelectTransfer]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu khởi tạo vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => fetchInitialData());
    }, [fetchInitialData]);

    const idDaTao = form.transferId ? daTao[String(form.transferId)] ?? null : null;

    // Trả về id phiếu xuất của yêu cầu đang chọn (đã có hoặc vừa tạo); null nếu chưa tạo được / đang tạo dở
    async function createPhieu() {
        if (!form.transferId) return toast.error("Vui lòng chọn yêu cầu chuyển kho"), null;
        if (idDaTao) return idDaTao;
        if (dangTaoRef.current) return null;
        dangTaoRef.current = true;
        try {
            setLoading(true);
            lamViecTaiKho(selectedTransfer?.khoXuatId || form.khoId);
            const res = await phieuChuyenKhoService.createExport(form.transferId);
            const newId = res.data?.data?.id || res.data?.id || res.id;
            if (newId) setDaTao(prev => ({ ...prev, [String(form.transferId)]: newId }));
            toast.success("Khởi tạo phiếu xuất chuyển kho thành công");
            return newId || null;
        } catch (e) {
            toast.error(e?.response?.data?.message || "Không thể tạo phiếu xuất chuyển kho");
            return null;
        } finally {
            setLoading(false);
            dangTaoRef.current = false;
        }
    }

    async function handleSaveDraft() { await createPhieu(); }
    async function handleContinue() {
        const id = await createPhieu();
        if (id) navigate(`/goods-issues/${id}`);
    }

    // ── Bảng hàng: dùng chung cách đọc dòng của Chi tiết phiếu chuyển (màu, kích cỡ, ảnh khi máy chủ có) ──
    const dongBang = useMemo(() => dongChuyenKho(selectedTransfer?.items), [selectedTransfer]);
    const bangHang = useBangChungTu(dongBang);

    if (dangTai) {
        return (
            <PageContainer>
                <LoadingState rows={4} label="Đang tải dữ liệu khởi tạo" />
            </PageContainer>
        );
    }

    const khoXuatTen = selectedTransfer?.khoXuatTen
        || warehouses.find(k => String(k.id) === String(form.khoId))?.tenKho
        || "";

    const lyDoKhoa = dangTaiPhieu
        ? "Đang tải yêu cầu chuyển kho"
        : !form.transferId || !selectedTransfer
            ? "Chọn yêu cầu chuyển kho"
            : "";
    const khoa = Boolean(lyDoKhoa) || loading;

    const dongPhu = selectedTransfer
        ? [
            "Xuất chuyển kho nội bộ",
            `${soVN(bangHang.tong.soSanPham)} sản phẩm · ${soVN(bangHang.tong.soDong)} biến thể`,
            `Tổng xuất ${soVN(bangHang.tong.soLuong)}`,
        ]
        : khoXuatTen ? ["Xuất chuyển kho nội bộ", `Từ ${khoXuatTen}`] : "Xuất chuyển kho nội bộ";

    const thongBao = [
        loiTai ? (
            <DongThongBao key="loi-tai" tone="bad" actions={<NutChu onClick={fetchInitialData}>Thử lại</NutChu>}>
                Không tải được danh sách yêu cầu chuyển kho chờ xuất.
            </DongThongBao>
        ) : null,
        idDaTao ? (
            <DongThongBao
                key="da-tao"
                tone="ok"
                actions={<NutChu onClick={() => navigate(`/goods-issues/${idDaTao}`)}>Mở phiếu xuất</NutChu>}
            >
                Đã tạo phiếu xuất cho yêu cầu này. Bấm Tiếp tục bốc lô để chọn lô xuất hàng.
            </DongThongBao>
        ) : null,
        <DongThongBao key="ban-hang" tone="neutral">
            Phiếu xuất bán hàng được tạo tự động khi hoàn tất nhặt hàng, có sẵn lô của phiếu nhặt. Gom đơn vào phiếu nhặt ở màn{" "}
            <Link to="/goods-issues/pending-orders" className="font-semibold text-bo-primary hover:underline">Đơn chờ xuất</Link>.
        </DongThongBao>,
    ].filter(Boolean);

    const chonYeuCau = (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-bo-border px-4 py-4 sm:px-6">
            <label className="relative grid w-full min-w-0 gap-1.5 sm:w-[480px]">
                <span className={NHAN_O}>
                    Yêu cầu chuyển kho <span className="text-bo-danger">*</span>
                </span>
                <select
                    className={O_CHON}
                    value={form.transferId}
                    disabled={loading || dangTaiPhieu}
                    onChange={(e) => { bangHang.xoaTuKhoa(); handleSelectTransfer(e.target.value); }}
                >
                    <option value="">{transferList.length ? "Chọn yêu cầu đã duyệt, chờ xuất hàng" : loiTai ? "Chưa tải được danh sách yêu cầu" : "Không có yêu cầu nào chờ xuất"}</option>
                    {transferList.map(t => (
                        <option key={t.id} value={t.id}>
                            {t.soPhieuXuat} · {t.kho?.tenKho} → {t.khoChuyenDen?.tenKho}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute bottom-2.5 right-3 size-4 text-bo-muted" aria-hidden="true" />
            </label>
        </div>
    );

    const bang = !selectedTransfer ? (
        <EmptyState
            icon={Package}
            title={dangTaiPhieu ? "Đang tải yêu cầu chuyển kho…" : "Chưa chọn yêu cầu chuyển kho"}
            description="Chỉ hiện yêu cầu đã duyệt xuất ở kho của bạn và chưa có phiếu xuất."
            className="min-h-[280px] flex-1"
        />
    ) : (
        <BangHangTaoPhieu
            bang={bangHang}
            cot={[{ ma: "sl", nhan: "Yêu cầu", lop: "w-28 text-right", nhom: (n) => soVN(n.tong.soLuong), dong: (d) => soVN(d.soLuong) }]}
            tenChungTu="Yêu cầu chuyển kho"
            nhan="Hàng trong yêu cầu chuyển kho"
            rongToiThieu="@2xl/khoi:min-w-[420px]"
        />
    );

    const cotPhai = selectedTransfer ? (
        <CotThuocTinh nhan="Thông tin yêu cầu chuyển kho">
            <NhomThuocTinh nhan="Tuyến chuyển">
                <TuyenChuyen khoNguon={selectedTransfer.khoXuatTen} khoDich={selectedTransfer.khoNhapTen} />
            </NhomThuocTinh>
            <NhomThuocTinh>
                <BangThuocTinh
                    muc={[
                        { nhan: "Ngày tạo", giaTri: ngayGio(selectedTransfer.ngayTao) },
                        { nhan: "Người duyệt", giaTri: selectedTransfer.nguoiDuyetTen, an: !selectedTransfer.nguoiDuyetTen || selectedTransfer.nguoiDuyetTen === "Chưa duyệt" },
                        { nhan: "Ghi chú", giaTri: selectedTransfer.ghiChu },
                    ]}
                />
            </NhomThuocTinh>
        </CotThuocTinh>
    ) : null;

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma="Tạo phiếu xuất kho"
                        dongPhu={dongPhu}
                        onQuayLai={() => navigate("/goods-issues")}
                        nhanQuayLai="Quay lại danh sách"
                        nutPhu={{
                            ma: "tao",
                            nhan: "Tạo phiếu",
                            onClick: handleSaveDraft,
                            khoa: khoa || Boolean(idDaTao),
                        }}
                        nutChinh={{
                            ma: "tiep",
                            nhan: "Tiếp tục bốc lô",
                            icon: ArrowRight,
                            onClick: handleContinue,
                            khoa,
                            lyDo: lyDoKhoa || undefined,
                            hienLyDo: true,
                            dangChay: loading,
                        }}
                    />
                }
                tienTrinh={chonYeuCau}
                thongBao={thongBao}
                chinh={bang}
                cotPhai={cotPhai}
            />
        </PageContainer>
    );
}
