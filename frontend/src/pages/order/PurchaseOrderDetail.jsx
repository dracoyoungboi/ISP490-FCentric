import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import DauTrangDonMua from "@/components/order/chi-tiet-don-mua/DauTrangDonMua";
import TienTrinhDonMua from "@/components/order/chi-tiet-don-mua/TienTrinhDonMua";
import BangDotNhan from "@/components/order/chi-tiet-don-mua/BangDotNhan";
import ThuocTinhDonMua from "@/components/order/chi-tiet-don-mua/ThuocTinhDonMua";
import {
    dungBangDotNhan,
    tinhBuocDonMua,
    tinhTienDoNhan,
    trangThaiGiao,
} from "@/components/order/chi-tiet-don-mua/tinhNhanHang";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import purchaseOrderService from "@/services/purchaseOrderService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { getKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Ai được tạo phiếu nhập kho từ đơn mua (giữ như trước): quản trị viên, quản lý kho, nhân viên kho.
// Cũng là các vai trò backend cho xem phiếu nhập kho (PhieuNhapKhoController: filter, detail).
const VAI_TRO_TAO_PHIEU_NHAP = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO];
// Ai xem được số đơn mua của nhà cung cấp (vai trò xem mọi kho, quản lý nhà cung cấp).
const VAI_TRO_XEM_SO_DON_NCC = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];
// Trạng thái đơn được tạo phiếu nhập — đúng như backend PhieuNhapKhoService.createDraft đang nhận:
// 3 Đang vận chuyển, 5 Đã thanh toán (dữ liệu cũ).
const TRANG_THAI_TAO_PHIEU_NHAP = [3, 5];

/**
 * Chi tiết đơn mua hàng · bản "một khối" (chốt 16/10/2026): đầu khối, tiến trình 6 bước,
 * bảng sản phẩm theo từng đợt nhận (mỗi phiếu nhập kho là một cột) và cột thông tin bên phải.
 * Bỏ phần thanh toán cho nhà cung cấp: kế toán thanh toán ngoài hệ thống.
 */
export default function PurchaseOrderDetail() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();

    // ── Đơn mua hàng ────────────────────────────────────────────────────────
    const taiDon = useCallback(async () => {
        const res = await purchaseOrderService.getById(id);
        return res?.data ?? null;
    }, [id]);
    const donQ = useTaiDuLieu(taiDon, `don-mua-${id}`, { enabled: Boolean(id) });
    const don = donQ.data && String(donQ.data.id) === String(id) ? donQ.data : null;

    // ── Các phiếu nhập kho của đơn (không chặn trang khi lỗi) ───────────────
    // NV mua hàng xem được đơn nhưng không được gọi API phiếu nhập (backend trả 403): không gọi, bảng chỉ có số của đơn.
    const xemDotNhan = hasAnyRole(VAI_TRO_TAO_PHIEU_NHAP);
    const taiDot = useCallback(() => phieuNhapKhoService.layTheoDonMua(id), [id]);
    const dotQ = useTaiDuLieu(taiDot, `dot-nhan-${id}`, { enabled: Boolean(id) && xemDotNhan });

    // ── Số đơn mua của nhà cung cấp (chỉ vai trò xem mọi kho) ───────────────
    const nccId = don?.nhaCungCap?.id;
    const xemSoDonNcc = hasAnyRole(VAI_TRO_XEM_SO_DON_NCC);
    const taiSoDonNcc = useCallback(async () => {
        const res = await purchaseOrderService.filter({
            page: 0,
            size: 1,
            filters: [
                { fieldName: "nhaCungCap.id", operation: "EQUALS", value: nccId },
                { fieldName: "trangThai", operation: "IN", value: TRANG_THAI_TAO_PHIEU_NHAP },
            ],
            sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
        });
        return res?.data?.totalElements ?? null;
    }, [nccId]);
    const soDonQ = useTaiDuLieu(taiSoDonNcc, `so-don-ncc-${nccId}`, { enabled: Boolean(nccId) && xemSoDonNcc });

    // ── Tính toán ───────────────────────────────────────────────────────────
    const phieus = dotQ.data;
    const tienDo = useMemo(() => tinhTienDoNhan(don?.chiTietDonMuaHangs), [don]);
    const bang = useMemo(() => dungBangDotNhan(don?.chiTietDonMuaHangs, phieus), [don, phieus]);
    const buoc = useMemo(() => tinhBuocDonMua(don, tienDo, bang.cot), [don, tienDo, bang.cot]);
    const giao = trangThaiGiao(don?.ngayGiaoDuKien, tienDo.daDu);

    useEffect(() => {
        if (bang.lechSo.length) {
            console.warn("[Chi tiết đơn mua] Tổng các đợt đã nhập khác số đã nhận của đơn:", bang.lechSo);
        }
    }, [bang.lechSo]);

    // ── Nút Tạo phiếu nhập kho ──────────────────────────────────────────────
    const laQuanTriVien = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
    const khoNhanId = don?.khoNhap?.id ?? null;
    const khoLamViecId = getKhoLamViecId();
    const saiKho = !laQuanTriVien && khoNhanId != null && khoLamViecId !== khoNhanId;
    const taoPhieu = {
        hien: Boolean(don) && hasAnyRole(VAI_TRO_TAO_PHIEU_NHAP) && TRANG_THAI_TAO_PHIEU_NHAP.includes(Number(don?.trangThai)),
        khoa: tienDo.daDu || saiKho,
        lyDo: tienDo.daDu
            ? "Đã nhập đủ số lượng"
            : saiKho
                ? `Chọn kho làm việc ${don?.khoNhap?.tenKho || "của đơn"} để nhập hàng cho đơn này`
                : "",
    };

    const quayLai = () => {
        // Mở thẳng bằng đường dẫn (không có trang trước trong ứng dụng) thì về danh sách đơn mua
        if (location.key === "default") navigate("/purchase-orders");
        else navigate(-1);
    };

    // ── Đang tải / lỗi / không tìm thấy ────────────────────────────────────
    if (!don && (donQ.loading || (!donQ.error && donQ.data === undefined))) {
        return (
            <PageContainer>
                <SurfaceCard>
                    <LoadingState label="Đang tải dữ liệu đơn hàng" />
                </SurfaceCard>
            </PageContainer>
        );
    }

    if (!don) {
        // Máy chủ trả 400 "Không tìm thấy đơn mua hàng id: …" khi mã không tồn tại
        const status = getApiErrorStatus(donQ.error);
        const khongThay = !donQ.error || status === 404 || status === 400;
        return (
            <PageContainer>
                <SurfaceCard contentClassName="p-0 sm:p-0">
                    {khongThay ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy đơn mua hàng"
                            description="Đơn mua hàng không tồn tại hoặc đã bị xóa khỏi hệ thống."
                            action={
                                <Button
                                    onClick={() => navigate("/purchase-orders")}
                                    className="bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                                >
                                    Quay lại danh sách
                                </Button>
                            }
                        />
                    ) : (
                        <ErrorState
                            title="Không thể tải chi tiết đơn mua hàng"
                            description={getApiErrorMessage(donQ.error, "Không thể tải chi tiết đơn mua hàng")}
                            onRetry={donQ.reload}
                        />
                    )}
                </SurfaceCard>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="flex min-h-full flex-col">
            <article className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <DauTrangDonMua
                    don={don}
                    taoPhieu={taoPhieu}
                    onQuayLai={quayLai}
                    onIn={() => navigate(`/purchase-orders/${don.id}/print`)}
                    onTaoPhieu={() => navigate(`/goods-receipts/create?poId=${don.id}`)}
                    onMoYeuCau={() => navigate(`/purchase-requests/${don.yeuCauMuaHang?.id}`)}
                />
                <TienTrinhDonMua buoc={buoc} />
                <div className="grid flex-1 border-t border-bo-border xl:grid-cols-[minmax(0,1fr)_340px]">
                    <BangDotNhan
                        bang={bang}
                        tongTien={don.tongTien}
                        xemDot={xemDotNhan}
                        dangTaiDot={dotQ.loading}
                        loiDot={dotQ.error ? getApiErrorMessage(dotQ.error, "") : null}
                        onThuLai={dotQ.reload}
                    />
                    <ThuocTinhDonMua
                        don={don}
                        giao={giao}
                        soDonCuaNcc={xemSoDonNcc && !soDonQ.error ? soDonQ.data ?? null : null}
                    />
                </div>
            </article>
        </PageContainer>
    );
}
