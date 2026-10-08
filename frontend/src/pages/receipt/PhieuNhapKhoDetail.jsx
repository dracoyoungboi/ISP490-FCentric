import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { toast } from "sonner";
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    Check,
    ClipboardList,
    Info as InfoIcon,
    Loader2,
    Package,
    Printer,
    Truck,
    User,
    Warehouse,
    X,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import { getGoodsReceiptStatus, getGoodsReceiptTypeLabel } from "@/constants/goodsReceipt";

export default function PhieuNhapKhoDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        try {
            const res = await phieuNhapKhoService.getDetail(id);
            setData(res?.data || res);
        } catch (e) {
            console.error(e);
            toast.error("Không thể tải chi tiết phiếu nhập");
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); chi tiết vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => fetchDetail());
    }, [fetchDetail]);

    if (loading || !data) {
        return (
            <PageContainer>
                <LoadingState rows={4} label="Đang tải chi tiết phiếu nhập" />
            </PageContainer>
        );
    }

    // 1. Nếu có data.soDonMua -> Nhập từ Đối tác (PO)
    // 2. Nếu có data.phieuXuatGocId -> Nhập từ phiếu Chuyển kho / Hủy luân chuyển
    // 3. Nếu không có cả hai -> Nhập hoàn trả (Sales Return)
    const isPO = !!data.soDonMua;
    const isTransfer = !!data.phieuXuatGocId;
    const isSalesReturn = !isPO && !isTransfer;

    const isInternalTransfer = isTransfer;
    const isReturn = isSalesReturn || (data.loaiNhap || "").toLowerCase().includes("hoàn trả") || (data.soPhieuNhap || "").includes("-RET-");

    const isAllDuLo = (data.items || []).every(item => item.daDuLo === true);

    // Phiếu luân chuyển hoặc phiếu trả hàng (kế thừa) thì pass qua check lô
    const canComplete = isInternalTransfer || isSalesReturn || isAllDuLo;

    const displayLoaiNhap = getGoodsReceiptTypeLabel(data);

    const handleConfirmImport = async () => {
        setIsProcessing(true);
        try {
            if (isInternalTransfer) {
                // Riêng phiếu Transfer mới gọi API completeTransferReceipt
                await phieuNhapKhoService.completeTransferReceipt(id);
                toast.success("Nhận hàng luân chuyển thành công!");
            } else {
                // PO và Return gọi API complete chung
                await phieuNhapKhoService.complete(id);
                toast.success(isSalesReturn ? "Nhập kho hoàn trả thành công!" : "Nhập kho từ đối tác thành công!");
            }
            setShowCompleteConfirm(false);
            fetchDetail();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Xác nhận nhập kho thất bại");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelImport = async () => {
        setIsProcessing(true);
        try {
            await phieuNhapKhoService.cancel(id);
            toast.success("Đã hủy phiếu nhập thành công");
            setShowCancelConfirm(false);
            navigate("/goods-receipts");
        } catch (e) {
            toast.error(e?.response?.data?.message || "Hủy phiếu thất bại");
        } finally {
            setIsProcessing(false);
        }
    };

    const calculateTotalImport = () => {
        if (!data || !data.items) return 0;
        return data.items.reduce((acc, item) => acc + (item.soLuongDaKhaiBao || item.soLuongCanNhap || 0), 0);
    };

    const statusInfo = getGoodsReceiptStatus(data.trangThai);

    return (
        <PageContainer className="space-y-5">
            {/* ── Header ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => navigate("/goods-receipts")}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại danh sách
                </button>

                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={statusInfo.label} tone={statusInfo.tone} className="uppercase" />

                    {data.trangThai !== 4 && (
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/goods-receipts/${id}/print`)}
                            className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <Printer className="size-4" /> In phiếu
                        </Button>
                    )}

                    {/* Không cho phép hủy đối với phiếu Hoàn trả Sales Return */}
                    {!isReturn && data.trangThai === 0 && (
                        <Button
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => setShowCancelConfirm(true)}
                            className="gap-2 border-red-200 bg-white text-bo-danger hover:bg-bo-danger-soft disabled:opacity-50"
                        >
                            <X className="size-4" /> Huỷ phiếu
                        </Button>
                    )}

                    {data.trangThai === 0 && (
                        <Button
                            disabled={!canComplete || isProcessing}
                            onClick={() => setShowCompleteConfirm(true)}
                            className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                            {isInternalTransfer ? "Nhận hàng" : (isSalesReturn ? "Xác nhận Nhập trả" : "Xác nhận Nhập kho")}
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Info Section ── */}
            <SurfaceCard className="relative">
                {isReturn && (
                    <div className="absolute right-0 top-0 rounded-bl-lg bg-bo-danger px-3 py-1.5 text-[9px] font-bold tracking-widest text-white">
                        RETURN·PHIẾU HOÀN TRẢ
                    </div>
                )}

                <div className="mb-5 flex items-center gap-2">
                    <ClipboardList className="size-4 text-bo-primary" />
                    <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">Thông tin nghiệp vụ</h2>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoItem icon={<Package className="size-3.5" />} label="Số phiếu nhập" value={data.soPhieuNhap} highlight />

                    {isInternalTransfer ? (
                        <InfoItem icon={<Warehouse className="size-3.5" />} label="Kho đích" value={data.tenKho} />
                    ) : (
                        <>
                            <InfoItem icon={<Warehouse className="size-3.5" />} label="Kho nhập hàng" value={data.tenKho} />
                            {!isSalesReturn && <InfoItem icon={<Truck className="size-3.5" />} label="Nhà cung cấp" value={data.tenNhaCungCap} />}
                        </>
                    )}

                    <InfoItem icon={<InfoIcon className="size-3.5" />} label="Loại nghiệp vụ" value={displayLoaiNhap} />

                    {/* Nguồn gốc chứng từ dựa trên loại luồng */}
                    {isPO && <InfoItem icon={<ClipboardList className="size-3.5" />} label="Đơn mua (PO)" value={data.soDonMua} />}
                    {isInternalTransfer && <InfoItem icon={<ClipboardList className="size-3.5" />} label="Phiếu xuất gốc" value={data.soPhieuXuatGoc || (data.phieuXuatGocId ? `#${data.phieuXuatGocId}` : "Tự động")} />}
                    {isSalesReturn && <InfoItem icon={<ClipboardList className="size-3.5" />} label="Ghi chú" value="Tự động kế thừa lô" />}

                    <InfoItem icon={<Calendar className="size-3.5" />} label="Ngày nhập" value={data.ngayNhap ? new Date(data.ngayNhap).toLocaleDateString("vi-VN") : "---"} />
                    <InfoItem icon={<User className="size-3.5" />} label="Người nhập" value={data.tenNguoiNhap || "---"} />
                </div>

                {!canComplete && data.trangThai === 0 && (
                    <div className="mt-5 flex items-start gap-3 rounded-lg border border-bo-warning/20 bg-bo-warning-soft p-3">
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-bo-warning" />
                        <p className="text-xs font-medium leading-5 text-bo-warning">
                            Hệ thống yêu cầu khai báo đầy đủ thông tin lô hàng (số lượng, hạn dùng...) cho tất cả sản phẩm trước khi hoàn tất nhập kho thực tế.
                        </p>
                    </div>
                )}
            </SurfaceCard>

            {/* ── Product List ── */}
            <TableShell
                title="Danh sách hàng hóa"
                toolbar={
                    (isInternalTransfer || isSalesReturn) ? (
                        <div className="flex items-center justify-end border-b border-bo-border px-4 py-2.5 sm:px-5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Tự động kế thừa lô
                            </span>
                        </div>
                    ) : null
                }
            >
                <table className="w-full min-w-[760px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm / Biến thể</th>
                            <th className="h-10 px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL Cần nhập</th>
                            <th className="h-10 px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL Thực tế</th>
                            <th className="h-10 px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                            <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {(data.items || []).map((item) => (
                            <tr key={item.bienTheSanPhamId || Math.random()} className="transition-colors hover:bg-bo-surface-subtle">
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="w-fit rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">
                                            {item.sku}
                                        </span>
                                        <span className="line-clamp-1 font-semibold text-bo-foreground">{item.tenBienThe}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-bo-foreground">
                                    {item.soLuongCanNhap || 0}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`font-mono text-sm font-semibold ${(item.daDuLo || isInternalTransfer || isSalesReturn) ? "text-bo-success" : "text-bo-warning"}`}>
                                        {(isInternalTransfer || isSalesReturn) ? (item.soLuongCanNhap || 0) : (item.soLuongDaKhaiBao || 0)}
                                        <span className="mx-1 font-normal text-bo-muted">/</span>
                                        {item.soLuongCanNhap || 0}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {(item.daDuLo || isInternalTransfer || isSalesReturn) ? (
                                        <StatusBadge label="Đủ hàng" tone="success" />
                                    ) : (
                                        <StatusBadge label="Thiếu lô" tone="warning" />
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/goods-receipts/${data.id}/lot-input/${item.bienTheSanPhamId}`)}
                                        className="h-8 border-bo-border bg-white px-3 text-xs text-bo-foreground hover:border-bo-primary hover:text-bo-primary"
                                    >
                                        {(isInternalTransfer || isSalesReturn) ? "Lô tự động" : (data.trangThai === 0 ? "Khai báo lô →" : "Xem lô")}
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {(data.items || []).length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-sm text-bo-muted">
                                    Chưa có hàng hóa trong phiếu nhập
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </TableShell>

            {/* ── Modals ── */}
            {showCompleteConfirm && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-bo-foreground/40 p-4 backdrop-blur-sm"
                >
                    <div className="w-full max-w-md overflow-hidden rounded-lg border border-bo-border bg-white shadow-lg">
                        <div className="px-5 pt-5 sm:px-6">
                            <h2 className="text-base font-semibold text-bo-foreground">
                                {isInternalTransfer ? "Nhận hàng luân chuyển" : (isSalesReturn ? "Xác nhận nhập trả kho" : "Xác nhận nhập kho")}
                            </h2>
                        </div>
                        <div className="px-5 py-4 text-sm leading-6 text-bo-muted sm:px-6">
                            {isInternalTransfer
                                ? `Xác nhận hàng đã về kho an toàn. Tồn kho sẽ được cộng vào kho (${data.tenKho}) dựa trên dữ liệu lô đã xuất.`
                                : `Hệ thống sẽ ghi nhận nhập thực tế ${calculateTotalImport()} sản phẩm vào kho hàng. Dữ liệu này sẽ được dùng để cập nhật giá vốn và tồn kho.`}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3.5 sm:px-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowCompleteConfirm(false)}
                                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Đóng
                            </Button>
                            <Button
                                onClick={handleConfirmImport}
                                disabled={isProcessing}
                                className="bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                Xác nhận
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {showCancelConfirm && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-bo-foreground/40 p-4 backdrop-blur-sm"
                >
                    <div className="w-full max-w-md overflow-hidden rounded-lg border border-bo-border bg-white shadow-lg">
                        <div className="px-5 pt-5 sm:px-6">
                            <h2 className="text-base font-semibold text-bo-foreground">Hủy phiếu nhập kho</h2>
                        </div>
                        <div className="px-5 py-4 text-sm leading-6 text-bo-muted sm:px-6">
                            Thao tác này sẽ hủy phiếu hiện tại và không thể hoàn tác. Bạn có chắc chắn muốn thực hiện?
                        </div>
                        <div className="flex justify-end gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3.5 sm:px-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowCancelConfirm(false)}
                                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Quay lại
                            </Button>
                            <Button
                                onClick={handleCancelImport}
                                disabled={isProcessing}
                                className="bg-bo-danger text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                Xác nhận hủy
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}

function InfoItem({ icon, label, value, highlight }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
                <span className="text-bo-primary">{icon}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-bo-muted">{label}</span>
            </div>
            <span className={highlight ? "break-words text-base font-bold text-bo-primary" : "break-words text-sm font-semibold text-bo-foreground"}>
                {value || "---"}
            </span>
        </div>
    );
}
