import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { PHIEU_XUAT_CHUA_XUAT, TRANG_THAI_PHIEU_XUAT } from "@/constants/trangThaiXuatBan";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ConfirmModal from "@/components/ui/confirm-modal";
import DispatchDialog from "@/components/outbound/DispatchDialog";
import { Button } from "@/components/ui/button";
import {
    Loader2, Printer, Check, X,
    ClipboardList, Package, Warehouse,
    Calendar, User, AlertCircle, Info as InfoIcon,
    ArrowRight, ArrowLeft, MapPin, SearchX, PackageCheck
} from "lucide-react";
import { PHIEU_XUAT_KHO_STATUS, getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { hasAnyRole, ROLES } from "@/utils/roles";

// Trạng thái phiếu xuất — dùng chung tên với danh sách và bản in (constants/phieuXuatKho)
const STATUS_UI = PHIEU_XUAT_KHO_STATUS;

const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

export default function PhieuXuatKhoDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    // null: không lỗi; { khongTimThay, moTa }: lần tải gần nhất lỗi
    const [loadError, setLoadError] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showDispatch, setShowDispatch] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Chỉ nhận kết quả của lần tải mới nhất: lần tải ngầm về chậm không đè dữ liệu của lần tải sau (Thử lại, đổi phiếu)
    const requestIdRef = useRef(0);
    // silent: tải lại ngầm khi quay lại tab — giữ màn đang xem, chỉ thay khi tải được dữ liệu mới
    const fetchDetail = useCallback(async ({ silent = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const res = await phieuXuatKhoService.getDetail(id);
            if (requestId !== requestIdRef.current) return;
            const payload = res?.data || res;
            if (payload?.phieu) {
                setData(payload);
                setLoadError(null);
            } else if (!silent) {
                // Máy chủ trả về rỗng: coi như không có phiếu này
                setData(null);
                setLoadError({ khongTimThay: true });
            }
        } catch (e) {
            if (requestId !== requestIdRef.current) return;
            if (silent) {
                console.error(e);
                return;
            }
            setData(null);
            setLoadError({
                khongTimThay: getApiErrorStatus(e) === 404,
                moTa: getApiErrorMessage(e, "Đã xảy ra lỗi khi tải phiếu xuất kho. Vui lòng thử lại."),
            });
        } finally {
            if (!silent && requestId === requestIdRef.current) setLoading(false);
        }
    }, [id]);


    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn tải lại chi tiết mỗi khi id đổi.
    useEffect(() => {
        queueMicrotask(() => fetchDetail());
    }, [fetchDetail]);

    // Quay lại tab thì tải lại ngầm (trạng thái phiếu do kho cập nhật); không tải khi đang thao tác
    useTaiLaiKhiQuayLai(() => fetchDetail({ silent: true }), { bat: Boolean(data) && !loading && !isProcessing });

    // Hàm xử lý khi xác nhận Hoàn thành/Vận chuyển
    const handleConfirmComplete = async () => {
        setIsProcessing(true);
        try {
            await phieuXuatKhoService.complete(data.phieu.id);

            if (isChuyenKho) {
                toast.success("Xác nhận xuất kho và bắt đầu vận chuyển thành công");
            } else {
                toast.success("Hoàn thành phiếu xuất bán hàng thành công");
            }
            navigate("/goods-issues");
        } catch (e) {
            toast.error(e?.response?.data?.message || "Không thể thực hiện thao tác");
        } finally {
            setIsProcessing(false);
            setShowConfirm(false);
        }
    };

    // Xuất bán hàng: xác nhận xuất kho kèm thông tin giao vận (POST /{id}/xac-nhan-xuat-kho, SRS 6.3.2).
    // Lỗi thì giữ hộp thoại để người dùng sửa và thử lại.
    const handleDispatch = async (payload) => {
        setIsProcessing(true);
        try {
            const res = await phieuXuatKhoService.xacNhanXuatKho(data.phieu.id, payload);
            toast.success(res?.message || "Xác nhận xuất kho thành công");
            setShowDispatch(false);
            navigate("/goods-issues");
        } catch (e) {
            toast.error(e?.response?.data?.message || "Không thể xác nhận xuất kho");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelExport = async () => {
        setIsProcessing(true);
        try {
            if (isChuyenKho) {
                await phieuChuyenKhoService.cancel(data.phieu.id);
            } else {
                await phieuXuatKhoService.cancel(data.phieu.id);
            }
            toast.success("Đã hủy phiếu xuất thành công");
            navigate("/goods-issues");
        } catch (e) {
            toast.error(e?.response?.data?.message || "Không thể hủy phiếu");
        } finally {
            setIsProcessing(false);
            setShowCancelConfirm(false);
        }
    };

    // Đang tải, lỗi tải hoặc không có phiếu: vẫn giữ nút quay lại danh sách
    if (loading || !data) {
        return (
            <PageContainer className="space-y-5">
                <button
                    type="button"
                    onClick={() => navigate("/goods-issues")}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại danh sách
                </button>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    {loading || !loadError ? (
                        <LoadingState rows={5} label="Đang tải dữ liệu phiếu xuất kho" />
                    ) : loadError.khongTimThay ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy phiếu xuất kho"
                            description="Phiếu xuất kho không tồn tại hoặc đã bị xóa khỏi hệ thống."
                            action={
                                <Button
                                    onClick={() => navigate("/goods-issues")}
                                    className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                                >
                                    Về danh sách phiếu xuất
                                </Button>
                            }
                        />
                    ) : (
                        <ErrorState
                            title="Không tải được phiếu xuất kho"
                            description={loadError.moTa}
                            onRetry={() => fetchDetail()}
                        />
                    )}
                </div>
            </PageContainer>
        );
    }

    const { phieu, chiTiet } = data;
    const isChuyenKho = phieu.loaiXuat === "chuyen_kho";
    // Phiếu bán hàng phải đóng gói (Scan-to-Pack) xong mới xuất kho; phiếu chuyển kho xuất từ Nháp.
    const trangThaiDuocXuat = isChuyenKho ? TRANG_THAI_PHIEU_XUAT.NHAP : TRANG_THAI_PHIEU_XUAT.CHO_XUAT;
    const choDongGoi = !isChuyenKho && phieu.trangThai === TRANG_THAI_PHIEU_XUAT.NHAP && phieu.donBanHang?.id;

    // Kiểm tra xem tất cả mặt hàng đã bốc đủ lô chưa
    const isAllPicked = Array.isArray(chiTiet)
        && chiTiet.length > 0
        && chiTiet.every(ct => ct.duSoLuong === true);

    // Lô của phiếu bán hàng lấy từ phân bổ ở phiếu nhặt: nhân viên chỉ xem; quản lý kho / quản trị viên sửa lô
    // (lấy nhầm lô, lô cũ không còn khi tạo lại phiếu) khi phiếu chưa xuất. Phiếu chuyển kho chọn lô ở Nháp như cũ.
    const laQuanLy = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
    const phieuChuaXuat = phieu.trangThai === TRANG_THAI_PHIEU_XUAT.NHAP || phieu.trangThai === TRANG_THAI_PHIEU_XUAT.CHO_XUAT;
    const canEditLot = isChuyenKho
        ? phieu.trangThai === TRANG_THAI_PHIEU_XUAT.NHAP
        : laQuanLy && phieuChuaXuat;
    const nhanNutLo = !canEditLot ? "Xem lô" : isChuyenKho ? "Chọn lô" : "Sửa lô";
    const banHangThieuLo = !isChuyenKho && phieuChuaXuat && !isAllPicked;

    const statusInfo = getPhieuXuatKhoStatus(phieu.trangThai);

    return (
        <PageContainer className="space-y-5">

            {/* ── Header actions only (title moved to global top header) ── */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <button
                    type="button"
                    onClick={() => navigate("/goods-issues")}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại danh sách
                </button>

                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge size="lg" label={statusInfo.label} />

                    {/* Nút Hủy: Hiện cho các trạng thái chưa xuất / chưa hủy */}
                    {PHIEU_XUAT_CHUA_XUAT.includes(phieu.trangThai) && (
                        <Button
                            disabled={isProcessing}
                            variant="outline"
                            onClick={() => setShowCancelConfirm(true)}
                            className="gap-2 border-bo-danger/30 bg-bo-danger-soft text-bo-danger hover:bg-bo-danger-soft/70 hover:text-bo-danger"
                        >
                            <X className="size-4" /> Hủy phiếu
                        </Button>
                    )}

                    {/* NÚT IN PHIẾU */}
                    {phieu.trangThai !== 4 && (
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/goods-issues/${phieu.id}/print`)}
                            className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <Printer className="size-4" /> In phiếu
                        </Button>
                    )}

                    {/* Phiếu bán hàng còn Nháp: đóng gói trước khi xuất kho */}
                    {choDongGoi && (
                        <Button
                            onClick={() => navigate(`/goods-issues/packing/${phieu.donBanHang.id}`)}
                            className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            <PackageCheck className="size-4" /> Đóng gói
                        </Button>
                    )}

                    {/* Nút Hoàn thành/Vận chuyển: phiếu bán hàng đã đóng gói (Chờ xuất), phiếu chuyển kho ở Nháp */}
                    {phieu.trangThai === trangThaiDuocXuat && (
                        <Button
                            disabled={isProcessing || !isAllPicked}
                            onClick={() => (isChuyenKho ? setShowConfirm(true) : setShowDispatch(true))}
                            className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                            {isChuyenKho ? "Xác nhận vận chuyển" : "Hoàn thành xuất kho"}
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Info Section ── */}
            <SurfaceCard title="Thông tin nghiệp vụ">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoItem icon={Package} label="Số phiếu xuất" value={phieu.soPhieuXuat} highlight />

                    <InfoItem
                        icon={InfoIcon}
                        label="Loại xuất"
                        value={isChuyenKho ? "Chuyển kho nội bộ" : "Xuất bán hàng"}
                    />

                    {isChuyenKho ? (
                        <InfoItem icon={Warehouse} label="Kho chuyển đến" value={phieu.khoChuyenDen?.tenKho} />
                    ) : (
                        <InfoItem
                            icon={ClipboardList}
                            label="Đơn bán hàng"
                            value={phieu.donBanHang?.id ? (
                                <Link to={`/sales-orders/${phieu.donBanHang.id}`} className="text-bo-primary hover:underline">
                                    {phieu.donBanHang.soDonHang}
                                </Link>
                            ) : phieu.donBanHang?.soDonHang}
                        />
                    )}

                    <InfoItem icon={Warehouse} label="Kho xuất hàng" value={phieu.kho?.tenKho} />

                    <InfoItem
                        icon={Calendar}
                        label="Ngày tạo phiếu"
                        value={formatDate(phieu.ngayTao)}
                    />

                    <InfoItem
                        icon={Calendar}
                        label="Ngày xuất"
                        value={phieu.ngayXuat ? formatDate(phieu.ngayXuat) : "Chưa xuất kho"}
                    />

                    <InfoItem
                        icon={User}
                        label="Người xuất"
                        value={phieu.nguoiXuat?.hoTen || "---"}
                    />
                </div>

                {!isChuyenKho && phieu.donBanHang?.diaChiGiaoHang && (
                    <div className="mt-5 border-t border-bo-border pt-4">
                        <InfoItem icon={MapPin} label="Địa chỉ giao hàng" value={phieu.donBanHang.diaChiGiaoHang} />
                    </div>
                )}

                {phieu.ghiChu && (
                    <div className="mt-5 border-t border-bo-border pt-4">
                        <InfoItem icon={InfoIcon} label="Ghi chú" value={phieu.ghiChu} />
                    </div>
                )}

                {isChuyenKho && phieu.trangThai === 0 && !isAllPicked && (
                    <div className="mt-5 flex items-center gap-3 rounded-lg border border-bo-warning/20 bg-bo-warning-soft p-3">
                        <AlertCircle className="size-4 shrink-0 text-bo-warning" />
                        <p className="text-xs font-medium text-bo-warning">
                            CẦN BỐC LÔ TRƯỚC KHI XUẤT HÀNG. Hệ thống yêu cầu xác định lô sản phẩm trước khi đưa vào kho Trung chuyển.
                        </p>
                    </div>
                )}

                {banHangThieuLo && (
                    <div role="status" className="mt-5 flex items-center gap-3 rounded-lg border border-bo-warning/20 bg-bo-warning-soft p-3">
                        <AlertCircle className="size-4 shrink-0 text-bo-warning" />
                        <p className="text-xs font-medium text-bo-warning">
                            Phiếu còn dòng chưa đủ lô nên chưa xuất kho được.{" "}
                            {laQuanLy
                                ? "Bấm Sửa lô ở dòng thiếu để chọn lô còn hàng."
                                : "Báo quản lý kho sửa lô cho các dòng thiếu."}
                        </p>
                    </div>
                )}
            </SurfaceCard>

            {/* ── Product List ── */}
            <TableShell
                title="Danh sách sản phẩm"
                description={`${chiTiet.length} mặt hàng cần xuất kho`}
            >
                {chiTiet.length === 0 ? (
                    <EmptyState
                        icon={Package}
                        title="Phiếu chưa có sản phẩm"
                        description="Phiếu xuất kho này chưa có dòng sản phẩm nào."
                    />
                ) : (
                <table className="w-full min-w-[900px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className={`${TH_CLASS} text-left`}>SKU / Biến thể</th>
                            <th className={`${TH_CLASS} text-center`}>SL yêu cầu</th>
                            <th className={`${TH_CLASS} text-center`}>SL đã lấy</th>
                            <th className={`${TH_CLASS} text-left`}>Trạng thái</th>
                            <th className={`${TH_CLASS} text-right`}>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {chiTiet.map((ct) => {
                            return (
                                <tr key={ct.id} className="transition-colors hover:bg-bo-surface-subtle">
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-col gap-1">
                                            <span className="w-fit rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">
                                                {ct.sku}
                                            </span>
                                            <span className="line-clamp-1 font-semibold text-bo-foreground">{ct.tenBienThe}</span>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3.5 text-center font-semibold text-bo-foreground">
                                        {ct.soLuongCanXuat}
                                    </td>

                                    <td className="px-4 py-3.5 text-center">
                                        <span className={`font-mono font-semibold ${ct.duSoLuong ? "text-bo-success" : "text-bo-warning"}`}>
                                            {ct.soLuongDaPick}
                                            <span className="mx-1 font-normal text-bo-muted">/</span>
                                            {ct.soLuongCanXuat}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3.5">
                                        {ct.duSoLuong ? (
                                            <StatusBadge label="Đủ hàng" />
                                        ) : (
                                            <StatusBadge label="Chưa đủ" />
                                        )}
                                    </td>

                                    <td className="px-4 py-3.5 text-right">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                navigate(
                                                    `/goods-issues/${phieu.id}/pick-lot/${ct.id}`,
                                                    {
                                                        state: {
                                                            bienTheSanPhamId: ct.bienTheSanPhamId,
                                                            sku: ct.sku,
                                                            tenBienThe: ct.tenBienThe,
                                                            soLuongXuat: ct.soLuongCanXuat,
                                                            soLuongDaPick: ct.soLuongDaPick,
                                                            phieuTrangThai: phieu.trangThai,
                                                            loaiXuat: phieu.loaiXuat
                                                        },
                                                    }
                                                )
                                            }
                                            className={`h-8 gap-1.5 px-3 text-xs font-semibold ${canEditLot
                                                ? "border-bo-primary/30 bg-bo-primary-soft text-bo-primary hover:bg-bo-primary-soft/70 hover:text-bo-primary"
                                                : "border-bo-border bg-white text-slate-600 hover:bg-bo-surface-subtle hover:text-slate-700"}`}
                                        >
                                            {nhanNutLo} <ArrowRight className="size-3" />
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                )}
            </TableShell>

            {/* ── Modals ── */}
            <ConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirmComplete}
                variant="danger"
                title={isChuyenKho ? "Xác nhận vận chuyển" : "Xác nhận xuất kho"}
                description={isChuyenKho
                    ? `Hàng hóa trong phiếu ${phieu.soPhieuXuat} sẽ được trừ tồn tại kho hiện tại và đưa vào kho Trung Chuyển để bắt đầu vận chuyển.`
                    : `Phiếu xuất kho ${phieu.soPhieuXuat} sẽ được hoàn thành và không thể chỉnh sửa.`}
                cancelText="Hủy"
                confirmText="Xác nhận thực hiện"
                isLoading={isProcessing}
            />

            {showDispatch ? (
                <DispatchDialog
                    open
                    onOpenChange={setShowDispatch}
                    soPhieuXuat={phieu.soPhieuXuat}
                    onConfirm={handleDispatch}
                />
            ) : null}

            <ConfirmModal
                isOpen={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={handleCancelExport}
                variant="danger"
                title="Hủy phiếu xuất kho"
                description={`Bạn chắc chắn muốn hủy phiếu ${phieu.soPhieuXuat}? Mọi số lượng đã bốc (giữ hàng) sẽ được hoàn tồn. Thao tác này không thể hoàn tác.`}
                cancelText="Quay lại"
                confirmText="Xác nhận hủy"
                isLoading={isProcessing}
            />
        </PageContainer>
    );
}

function InfoItem({ icon, label, value, highlight }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
                {createElement(icon, { className: "size-3.5 text-bo-primary" })}
                <span className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                    {label}
                </span>
            </div>
            <div className={`text-sm font-semibold ${highlight ? "text-bo-primary" : "text-bo-foreground"}`}>
                {value || "---"}
            </div>
        </div>
    );
}
