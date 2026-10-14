import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    ArrowLeft, Building2, Calendar, User, FileText, Package,
    CheckCircle, XCircle, Printer, Phone, Mail,
    Clock, Send, CreditCard, DollarSign, Loader2, SearchX
} from "lucide-react";

import apiClient from '@/services/apiClient';
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDate as dinhDangNgay, formatDateTime as dinhDangNgayGio } from "@/utils/formatters";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
};

// Chỉ NV Mua hàng và Quản trị viên mới được duyệt báo giá
const APPROVE_QUOTATION_ROLES = [ROLE.QUAN_TRI_VIEN, ROLE.NHAN_VIEN_MUA_HANG];

function parseJwt(token) {
    try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
    catch { return null; }
}

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

// Định dạng chung toàn hệ thống: 05/10/2026 · 08:03; trống → "—"
const formatDate = (dateString) => dinhDangNgay(dateString);

// Định dạng chung toàn hệ thống: 05/10/2026 · 08:03; trống → "—"
const formatDateTime = (dateString) => dinhDangNgayGio(dateString);

// ─── Status configs ────────────────────────────────────────────────────────────
const PO_STATUS = {
    0: { label: 'Đã xóa', tone: 'danger', icon: XCircle, desc: 'Báo giá này đã bị xóa khỏi hệ thống.' },
    1: { label: 'Đã gửi YC báo giá', tone: 'neutral', icon: Send, desc: 'Đã gửi email yêu cầu báo giá đến nhà cung cấp. Đang chờ phản hồi.' },
    2: { label: 'Đã nhận báo giá', tone: 'info', icon: FileText, desc: 'Nhà cung cấp đã cập nhật đơn giá. Vui lòng kiểm tra và duyệt.' },
    3: { label: 'Đã chuyển thành đơn mua hàng', tone: 'warning', icon: CheckCircle, desc: 'Báo giá đã được chấp nhận. Đơn hàng đang được vận chuyển từ nhà cung cấp.' },
    4: { label: 'Từ chối báo giá', tone: 'danger', icon: XCircle, desc: 'Báo giá này đã bị từ chối.' },
    5: { label: 'Đã thanh toán', tone: 'success', icon: CreditCard, desc: 'Đơn hàng đã được thanh toán thành công.' },
};

// Nền banner trạng thái — bám theo bảng tone của StatusBadge
const BANNER_TONES = {
    neutral: 'border-bo-border bg-bo-surface-subtle',
    info: 'border-blue-200 bg-bo-primary-soft',
    success: 'border-green-200 bg-bo-success-soft',
    warning: 'border-orange-200 bg-bo-warning-soft',
    danger: 'border-red-200 bg-bo-danger-soft',
};

// ── Shared components ──────────────────────────────────────────────────────────
function InfoField({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                {icon}
                {label}
            </div>
            <div className="text-sm leading-6 text-bo-foreground">{children}</div>
        </div>
    );
}

export default function QuotationDetail() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [orderData, setOrderData] = useState(null);
    const [loading, setLoading] = useState(true);
    // null | { notFound: true } | { notFound: false, message }
    const [loadError, setLoadError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Dialog States
    const [acceptDialog, setAcceptDialog] = useState(false);
    const [rejectDialog, setRejectDialog] = useState(false);

    const [userRoles, setUserRoles] = useState([]);
    const [loadingAuth, setLoadingAuth] = useState(true);

    const fetchOrderDetail = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            // Lấy chi tiết đơn mua hàng (báo giá) từ API
            const result = await apiClient.get(`/api/v1/don-mua-hang/get-by-id/${id}`);
            if (result && result.data?.data) {
                setOrderData(result.data.data);
            } else {
                setOrderData(null);
                setLoadError({ notFound: true });
            }
        } catch (error) {
            console.error('Error fetching PO detail:', error);
            setOrderData(null);
            // Máy chủ trả 400 "Không tìm thấy đơn mua hàng id: …" khi mã không tồn tại
            const status = getApiErrorStatus(error);
            setLoadError(status === 404 || status === 400
                ? { notFound: true }
                : { notFound: false, message: getApiErrorMessage(error, 'Không thể tải chi tiết báo giá') });
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    useEffect(() => {
        if (id) queueMicrotask(() => fetchOrderDetail());
    }, [id, fetchOrderDetail]);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) return;
                const payload = parseJwt(token);
                if (!payload || !payload.id) return;
                const userResponse = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
                const userData = userResponse.data?.data;
                if (userData?.vaiTro) setUserRoles(parseRoles(userData.vaiTro));
            } catch (error) {
                console.error('Error fetching user info:', error);
            } finally {
                setLoadingAuth(false);
            }
        };
        fetchUserInfo();
    }, []);

    const handleAction = async (trangThai) => {
        setActionLoading(true);
        try {
            await apiClient.put(`/api/v1/nghiep-vu/don-mua-hang/duyet-don/${id}/${trangThai}`);
            toast.success(trangThai === 3 ? 'Đã chấp nhận báo giá thành công' : 'Đã gửi email thông báo từ chối báo giá cho nhà cung cấp');
            setAcceptDialog(false);
            setRejectDialog(false);
            await fetchOrderDetail(); // Reload dữ liệu sau khi thao tác
        } catch (error) {
            console.error('Error action:', error);
            toast.error(error.response?.data?.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <SurfaceCard title="Chi tiết báo giá" description="Đang tải dữ liệu">
                    <LoadingState rows={4} label="Đang tải dữ liệu báo giá" />
                </SurfaceCard>
            </PageContainer>
        );
    }

    if (!orderData) {
        return (
            <PageContainer>
                <SurfaceCard contentClassName="p-0 sm:p-0">
                    {loadError && !loadError.notFound ? (
                        <ErrorState
                            title="Không thể tải chi tiết báo giá"
                            description={loadError.message}
                            onRetry={() => fetchOrderDetail()}
                        />
                    ) : (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy báo giá"
                            description="Báo giá không tồn tại hoặc đã bị xóa khỏi hệ thống."
                            action={
                                <Button
                                    onClick={() => navigate('/quotation-requests')}
                                    className="bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                                >
                                    Quay lại danh sách
                                </Button>
                            }
                        />
                    )}
                </SurfaceCard>
            </PageContainer>
        );
    }

    const currentStatus = PO_STATUS[orderData.trangThai] || { label: 'Không rõ', tone: 'neutral', icon: Clock, desc: '' };
    const StatusIcon = currentStatus.icon;
    const bannerClass = BANNER_TONES[currentStatus.tone] || BANNER_TONES.neutral;
    const canApprove = APPROVE_QUOTATION_ROLES.some(role => userRoles.includes(role));
    const showApproveActions = orderData.trangThai === 2;
    const canPay = orderData.trangThai === 3;

    return (
        <PageContainer className="space-y-5">
            <PageHeader
                eyebrow="Báo giá nhà cung cấp"
                title={orderData.soDonMua || '—'}
                description="Chi tiết báo giá, đơn giá nhà cung cấp và thao tác duyệt."
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => navigate(-1)}
                            className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <ArrowLeft className="size-4" /> Quay lại
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => window.print()}
                            className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <Printer className="size-4" /> In báo giá
                        </Button>

                        {/* ── Action Buttons ── */}
                        {(showApproveActions || canPay) && !loadingAuth && (
                            <div className="flex items-center justify-center gap-2">
                                {showApproveActions && canApprove && (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="gap-1.5 border-red-200 bg-bo-danger-soft font-medium text-bo-danger hover:bg-bo-danger-soft/70"
                                            onClick={() => setRejectDialog(true)}
                                        >
                                            <XCircle className="size-4" /> Từ chối
                                        </Button>
                                        <Button
                                            className="gap-1.5 bg-bo-success font-semibold text-white hover:bg-bo-success/90"
                                            onClick={() => setAcceptDialog(true)}
                                        >
                                            <CheckCircle className="size-4" /> Chấp nhận báo giá
                                        </Button>
                                    </>
                                )}
                                {canPay && (
                                    <Button
                                        className="gap-1.5 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                                        onClick={() => navigate(`/purchase-orders/${orderData.id}/payment`)}
                                    >
                                        <CreditCard className="size-4" /> Thanh toán ngay
                                    </Button>
                                )}
                            </div>
                        )}
                    </>
                }
            />

            {/* ── Status Banner ── */}
            <div className={`flex flex-col gap-5 rounded-lg border p-4 shadow-sm sm:p-5 md:flex-row md:items-center md:justify-between ${bannerClass}`}>
                <div className="flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-white/60 bg-white/70 text-bo-foreground">
                        <StatusIcon className="size-6" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold tracking-tight text-bo-foreground">{currentStatus.label}</h2>
                        <p className="mt-1 text-sm text-slate-600">{currentStatus.desc}</p>
                    </div>
                </div>

                <div className="rounded-lg border border-white/60 bg-white/80 px-5 py-3 text-right md:min-w-[240px]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền báo giá</p>
                    <p className={`mt-1 text-xl font-bold tracking-tight sm:text-2xl ${orderData.trangThai >= 2 ? 'text-bo-primary' : 'text-bo-muted'}`}>
                        {orderData.trangThai >= 2 ? formatCurrency(orderData.tongTien) : 'Đang chờ cập nhật'}
                    </p>
                </div>
            </div>

            {/* ── Info Cards Grid ── */}
            <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
                <SurfaceCard title="Thông tin báo giá" description="Mốc thời gian gửi và phản hồi">
                    <InfoField label="Ngày gửi" icon={<Calendar className="size-3.5" />}>
                        <span className="font-semibold">{formatDateTime(orderData.ngayDatHang)}</span>
                    </InfoField>
                    <div className="mt-4 border-t border-bo-border pt-4">
                        <InfoField label="Hạn phản hồi / giao dự kiến" icon={<Clock className="size-3.5" />}>
                            <span className="font-semibold">{formatDate(orderData.ngayGiaoDuKien)}</span>
                        </InfoField>
                    </div>
                </SurfaceCard>

                <SurfaceCard title="Nhà cung cấp" description="Thông tin liên hệ của nhà cung cấp">
                    {orderData.nhaCungCap ? (
                        <>
                            <InfoField label="Tên nhà cung cấp">
                                <div className="font-semibold">{orderData.nhaCungCap.tenNhaCungCap}</div>
                                <div className="mt-1">
                                    <span className="inline-flex rounded border border-blue-200 bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">
                                        {orderData.nhaCungCap.maNhaCungCap}
                                    </span>
                                </div>
                            </InfoField>
                            <div className="mt-4 space-y-4 border-t border-bo-border pt-4">
                                <InfoField label="Người liên hệ" icon={<User className="size-3.5" />}>
                                    <span className="font-semibold">{orderData.nhaCungCap.nguoiLienHe || '—'}</span>
                                </InfoField>
                                <InfoField label="Số điện thoại" icon={<Phone className="size-3.5" />}>
                                    <span className="font-mono font-semibold">{orderData.nhaCungCap.soDienThoai || '—'}</span>
                                </InfoField>
                                <InfoField label="Email" icon={<Mail className="size-3.5" />}>
                                    <span className="font-semibold">{orderData.nhaCungCap.email || '—'}</span>
                                </InfoField>
                            </div>
                        </>
                    ) : (
                        <EmptyState
                            icon={Building2}
                            title="Không có thông tin"
                            description="Báo giá chưa gắn nhà cung cấp."
                            className="min-h-0 py-6"
                        />
                    )}
                </SurfaceCard>

                <SurfaceCard title="Người phụ trách" description="Người tạo và người duyệt báo giá">
                    <InfoField label="Người tạo đơn gửi" icon={<CheckCircle className="size-3.5" />}>
                        <div className="font-semibold">{orderData.nguoiTao?.hoTen || '—'}</div>
                        <div className="mt-0.5 text-[13px] text-bo-muted">{orderData.nguoiTao?.email}</div>
                    </InfoField>
                    {orderData.nguoiDuyet && (
                        <div className="mt-4 border-t border-bo-border pt-4">
                            <InfoField label="Người duyệt báo giá" icon={<CheckCircle className="size-3.5" />}>
                                <div className="font-semibold">{orderData.nguoiDuyet.hoTen}</div>
                                <div className="mt-0.5 text-[13px] text-bo-muted">{orderData.nguoiDuyet.email}</div>
                            </InfoField>
                        </div>
                    )}
                </SurfaceCard>
            </div>

            {/* ── Product Table ── */}
            <TableShell
                title="Chi tiết sản phẩm báo giá"
                description="Đơn giá nhà cung cấp báo cho từng biến thể."
                footer={
                    <div className="flex justify-end">
                        <div className="w-full space-y-3 sm:w-96">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-bo-muted">Tổng số lượng SP:</span>
                                <span className="text-sm font-bold text-bo-foreground">
                                    {orderData.chiTietDonMuaHangs?.reduce((sum, item) => sum + item.soLuongDat, 0) || 0}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-bo-border bg-bo-surface-subtle px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="size-4 text-bo-primary" />
                                    <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">Tổng cộng:</span>
                                </div>
                                <span className="text-lg font-bold text-bo-primary">
                                    {orderData.trangThai >= 2 ? formatCurrency(orderData.tongTien) : '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                }
            >
                <table className="w-full min-w-[880px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-10 w-[350px] px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Màu sắc</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kích cỡ</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL Đặt</th>
                            <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đơn giá báo</th>
                            <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {orderData.chiTietDonMuaHangs?.length > 0 ? (
                            orderData.chiTietDonMuaHangs.map((item, index) => (
                                <tr key={item.id || index} className="transition-colors hover:bg-bo-surface-subtle">
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-3">
                                            {item.bienTheSanPham?.anhBienThe?.tepTin?.duongDan ? (
                                                <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-bo-border bg-slate-100">
                                                    <img src={item.bienTheSanPham.anhBienThe.tepTin.duongDan} alt="Ảnh sản phẩm"
                                                        className="size-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-bo-border bg-slate-100">
                                                    <Package className="size-5 text-slate-300" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold leading-tight text-bo-foreground">
                                                    {item.bienTheSanPham?.tenSanPham || item.bienTheSanPham?.tenBienThe || item.bienTheSanPham?.maSku}
                                                </p>
                                                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-bo-muted">
                                                    Mã: <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700">{item.bienTheSanPham?.maSku}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {/* data-viz: màu động theo maMauHex */}
                                            <span className="size-4 rounded-full border border-bo-border"
                                                style={{ backgroundColor: item.bienTheSanPham?.mauSac?.maMauHex }}
                                                title={item.bienTheSanPham?.mauSac?.tenMau} />
                                            <span className="text-[13px] font-medium text-slate-700">{item.bienTheSanPham?.mauSac?.tenMau}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md border border-bo-border bg-slate-100 px-2 text-xs font-semibold text-bo-foreground">
                                            {item.bienTheSanPham?.size?.maSize}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-blue-200 bg-bo-primary-soft px-3 font-semibold text-bo-primary">
                                            {item.soLuongDat}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-right text-sm font-medium">
                                        {item.donGia > 0 ? (
                                            <span className={orderData.trangThai >= 2 ? "font-semibold text-bo-success" : "text-bo-foreground"}>
                                                {formatCurrency(item.donGia)}
                                            </span>
                                        ) : (
                                            <span className="rounded-md border border-orange-200 bg-bo-warning-soft px-2.5 py-1 text-[13px] italic text-bo-warning">Chờ báo giá</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <span className="text-base font-bold text-bo-foreground">
                                            {item.thanhTien > 0 ? formatCurrency(item.thanhTien) : '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6}>
                                    <EmptyState
                                        icon={Package}
                                        title="Chưa có sản phẩm nào"
                                        description="Báo giá chưa có chi tiết sản phẩm."
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </TableShell>

            {/* ── Accept Dialog ── */}
            <AlertDialog open={acceptDialog} onOpenChange={setAcceptDialog}>
                <AlertDialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-white p-5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bo-success-soft text-bo-success">
                            <CheckCircle className="size-5" />
                        </div>
                        <AlertDialogTitle className="m-0 text-lg font-semibold text-bo-foreground">Xác nhận chấp nhận báo giá</AlertDialogTitle>
                    </div>
                    <div className="bg-white p-5">
                        <AlertDialogDescription className="mb-5 text-sm leading-6 text-slate-600">
                            Bạn có chắc chắn muốn chấp nhận báo giá này?
                            Hành động này sẽ chốt mức giá với nhà cung cấp.
                        </AlertDialogDescription>
                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel disabled={actionLoading} onClick={() => setAcceptDialog(false)}
                                className="m-0 h-10 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle">Hủy bỏ</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleAction(3)} disabled={actionLoading}
                                className="m-0 h-10 gap-2 bg-bo-success font-semibold text-white hover:bg-bo-success/90">
                                {actionLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                                Chấp nhận báo giá
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Reject Dialog ── */}
            <AlertDialog open={rejectDialog} onOpenChange={setRejectDialog}>
                <AlertDialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-white p-5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bo-danger-soft text-bo-danger">
                            <XCircle className="size-5" />
                        </div>
                        <AlertDialogTitle className="m-0 text-lg font-semibold text-bo-foreground">Từ chối báo giá</AlertDialogTitle>
                    </div>
                    <div className="bg-white p-5">
                        <AlertDialogDescription className="mb-4 text-sm leading-6 text-slate-600">
                            Bạn đang từ chối báo giá này. Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel disabled={actionLoading} onClick={() => { setRejectDialog(false); }}
                                className="m-0 h-10 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle">Hủy bỏ</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleAction(4)} disabled={actionLoading}
                                className="m-0 h-10 gap-2 bg-bo-danger font-semibold text-white hover:bg-bo-danger/90">
                                {actionLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                                Xác nhận từ chối
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}
