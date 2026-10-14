import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ArrowLeft, Warehouse, Calendar, User, FileText, Package,
    CheckCircle, Printer, MapPin, Clock, Send, CreditCard, ListChecks,
    Eye, Loader2, Ship, XCircle
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
import { YEU_CAU_NHAP_HANG_STATUS } from "@/constants/yeuCauNhapHang";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
};

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

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// ─── Status configs (Đồng bộ với List) ─────────────────────────────────────────
// Tên trạng thái yêu cầu lấy từ constants/yeuCauNhapHang (một tên cho danh sách, chi tiết, bản in)
const PR_STATUS = {
    3: { label: YEU_CAU_NHAP_HANG_STATUS[3].label, tone: 'info', icon: FileText, desc: 'Yêu cầu này đã được tạo thành các đơn báo giá để gửi NCC.' },
    5: { label: YEU_CAU_NHAP_HANG_STATUS[5].label, tone: 'success', icon: Ship, desc: 'Đã chốt báo giá, đơn hàng đang được tiến hành xử lý/vận chuyển.' },
};

const PO_STATUS = {
    0: { label: 'Đã xóa', tone: 'danger', icon: XCircle },
    1: { label: 'Đã gửi YC báo giá', tone: 'neutral', icon: Send },
    2: { label: 'Đã nhận báo giá', tone: 'info', icon: FileText },
    3: { label: 'Đã chuyển thành đơn mua hàng', tone: 'warning', icon: CheckCircle },
    4: { label: 'Từ chối báo giá', tone: 'danger', icon: XCircle },
    5: { label: 'Đã thanh toán', tone: 'success', icon: CreditCard },
};

// Nền banner trạng thái — bám theo bảng tone của StatusBadge
const BANNER_TONES = {
    neutral: 'border-bo-border bg-bo-surface-subtle',
    info: 'border-blue-200 bg-bo-primary-soft',
    success: 'border-green-200 bg-bo-success-soft',
    warning: 'border-orange-200 bg-bo-warning-soft',
    danger: 'border-red-200 bg-bo-danger-soft',
};

function getPaymentTooltip(trangThai) {
    switch (trangThai) {
        case 0: return 'Đơn đã bị xóa, không thể thanh toán';
        case 1: return 'Chưa nhận báo giá từ NCC, không thể thanh toán';
        case 2: return 'Chưa duyệt báo giá, không thể thanh toán';
        case 3: return 'Thanh toán đơn mua hàng';
        case 4: return 'Báo giá đã bị từ chối, không thể thanh toán';
        case 5: return 'Đơn đã được thanh toán rồi';
        default: return 'Không thể thanh toán';
    }
}

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

export default function QuotationRequestDetail() {
    const navigate = useNavigate();
    const { id } = useParams(); // ID Yêu cầu mua hàng

    const [orderData, setOrderData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // States Dialog
    const [acceptDialog, setAcceptDialog] = useState(false);
    const [rejectDialog, setRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [approvingPo, setApprovingPo] = useState(null); // Lưu ID của đơn PO đang được chọn duyệt/từ chối

    // Ghi chú: get-by-id ở loadDetail vẫn chạy như bản cũ; vaiTro từng chỉ nuôi
    // canApprove (dead UI chưa từng render) nên không còn lưu state.

    const fetchOrderDetail = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiClient.get(`/api/v1/yeu-cau-mua-hang/get-by-id/${id}`);
            if (result && result.data?.data) {
                setOrderData(result.data.data);
            }
        } catch (error) {
            console.error('Error fetching quotation detail:', error);
            toast.error('Không thể tải chi tiết yêu cầu báo giá');
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
                parseRoles(userData?.vaiTro);
            } catch (error) {
                console.error('Error fetching user info:', error);
            }
        };
        fetchUserInfo();
    }, []);

    // ── Hàm xử lý Duyệt/Từ chối cho từng Báo giá (PO) ──
    const handlePoAction = async (poId, trangThai) => {
        if (trangThai === 4 && !rejectReason.trim()) {
            toast.error('Vui lòng nhập lý do từ chối');
            return;
        }
        setActionLoading(true);
        try {
            await apiClient.put(`/api/v1/nghiep-vu/don-mua-hang/duyet-don/${poId}/${trangThai}`);
            toast.success(trangThai === 3 ? 'Đã chấp nhận báo giá thành công.' : 'Đã từ chối báo giá.');
            setAcceptDialog(false);
            setRejectDialog(false);
            setApprovingPo(null);
            setRejectReason('');
            await fetchOrderDetail(); // Tải lại data để cập nhật bảng
        } catch (error) {
            console.error('Error action:', error);
            toast.error('Không thể thực hiện thao tác. Vui lòng thử lại.');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePrint = () => navigate(`/quotation-requests/${id}/print`);

    if (loading) {
        return (
            <PageContainer>
                <SurfaceCard title="Chi tiết yêu cầu báo giá" description="Đang tải dữ liệu">
                    <LoadingState rows={4} label="Đang tải dữ liệu" />
                </SurfaceCard>
            </PageContainer>
        );
    }

    if (!orderData) {
        return (
            <PageContainer>
                <SurfaceCard>
                    <ErrorState
                        title="Không tìm thấy dữ liệu yêu cầu"
                        description="Yêu cầu mua hàng không tồn tại hoặc đã bị xóa."
                        onRetry={() => navigate('/quotation-requests')}
                    />
                </SurfaceCard>
            </PageContainer>
        );
    }

    const currentStatus = PR_STATUS[orderData.trangThai] || { label: 'Không rõ', tone: 'neutral', icon: Clock, desc: '' };
    const StatusIcon = currentStatus.icon;
    const bannerClass = BANNER_TONES[currentStatus.tone] || BANNER_TONES.neutral;

    // Ghi chú: UI duyệt/từ chối báo giá chưa từng có nút mở (dead UI từ bản cũ).

    // Tính tổng tiền các báo giá đã được chấp nhận
    const acceptedTotal = (orderData.donMuaHangs || [])
        .filter(po => po.trangThai === 3 || po.trangThai === 5)
        .reduce((sum, po) => sum + (Number(po.tongTien) || 0), 0);

    return (
        <PageContainer className="space-y-5">
            <PageHeader
                eyebrow="Yêu cầu báo giá"
                title={orderData.soYeuCauMuaHang || `#${id}`}
                description="Chi tiết yêu cầu mua hàng và các báo giá nhận về từ nhà cung cấp."
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => navigate('/quotation-requests')}
                            className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <ArrowLeft className="size-4" /> Quay lại danh sách
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handlePrint}
                            className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <Printer className="size-4" /> In thông tin
                        </Button>
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

                <div className="rounded-lg border border-white/60 bg-white/80 px-5 py-3 text-right md:min-w-[220px]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng giá trị chốt</p>
                    <p className={`mt-1 text-xl font-bold tracking-tight sm:text-2xl ${acceptedTotal > 0 ? 'text-bo-success' : 'text-bo-muted'}`}>
                        {acceptedTotal > 0 ? formatCurrency(acceptedTotal) : 'Chưa có'}
                    </p>
                </div>
            </div>

            {/* ── Info Cards Grid ── */}
            <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
                <SurfaceCard title="Thông tin yêu cầu" description="Thời gian và người tạo yêu cầu">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <InfoField label="Ngày tạo YC" icon={<Calendar className="size-3.5" />}>
                            <span className="font-semibold">{formatDateTime(orderData.ngayTao)}</span>
                        </InfoField>
                        <InfoField label="Ngày giao dự kiến" icon={<Clock className="size-3.5" />}>
                            <span className="font-semibold">{formatDate(orderData.ngayGiaoDuKien)}</span>
                        </InfoField>
                        <InfoField label="Người tạo" icon={<User className="size-3.5" />}>
                            <span className="font-semibold">{orderData.nguoiTao?.hoTen || '—'}</span>
                        </InfoField>
                        <InfoField label="Tổng sản phẩm" icon={<Package className="size-3.5" />}>
                            <span className="font-semibold text-bo-primary">{orderData.chiTietYeuCauMuaHangs?.length || 0} biến thể</span>
                        </InfoField>
                    </div>

                    <div className="mt-4 border-t border-bo-border pt-4">
                        <InfoField label="Ghi chú từ kho">
                            <span className="mt-1 block rounded-lg border border-bo-border bg-bo-surface-subtle p-3 leading-6 text-slate-600">
                                {orderData.ghiChu || <span className="italic text-bo-muted">Không có ghi chú</span>}
                            </span>
                        </InfoField>
                    </div>
                </SurfaceCard>

                <SurfaceCard title="Địa điểm nhận hàng" description="Kho tiếp nhận hàng hóa của yêu cầu">
                    <InfoField label="Tên kho">
                        <div className="font-semibold text-bo-foreground">{orderData.khoNhap?.tenKho || '—'}</div>
                        {orderData.khoNhap?.maKho && (
                            <div className="mt-1">
                                <span className="inline-flex rounded border border-orange-200 bg-bo-warning-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-warning">
                                    {orderData.khoNhap.maKho}
                                </span>
                            </div>
                        )}
                    </InfoField>

                    <div className="mt-4 border-t border-bo-border pt-4">
                        <InfoField label="Người quản lý kho" icon={<User className="size-3.5" />}>
                            <span className="font-semibold">{orderData.khoNhap?.quanLy?.hoTen || '—'}</span>
                        </InfoField>
                    </div>

                    <div className="mt-4">
                        <InfoField label="Địa chỉ" icon={<MapPin className="size-3.5" />}>
                            <span className="block leading-6 text-slate-600">{orderData.khoNhap?.diaChi || "—"}</span>
                        </InfoField>
                    </div>
                </SurfaceCard>
            </div>

            {/* ── Table 1: Sản phẩm cần mua (Từ Yêu Cầu Gốc) ── */}
            <TableShell
                title="Sản phẩm yêu cầu (gốc)"
                description="Danh sách biến thể cần mua theo yêu cầu ban đầu."
            >
                <table className="w-full min-w-[720px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-10 w-[350px] px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Màu sắc</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kích cỡ</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số lượng cần mua</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {(orderData.chiTietYeuCauMuaHangs || []).map((item, index) => (
                            <tr key={item.id || index} className="transition-colors hover:bg-bo-surface-subtle">
                                <td className="px-3 py-3">
                                    <div className="flex items-center gap-3">
                                        {item.bienTheSanPham?.anhBienThe?.tepTin?.duongDan ? (
                                            <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-bo-border bg-slate-100">
                                                <img src={item.bienTheSanPham.anhBienThe.tepTin.duongDan} alt="Ảnh sản phẩm" className="size-full object-cover" />
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
                                        <span className="size-4 rounded-full border border-bo-border" style={{ backgroundColor: item.bienTheSanPham?.mauSac?.maMauHex }} title={item.bienTheSanPham?.mauSac?.tenMau} />
                                        <span className="text-[13px] font-medium text-slate-700">{item.bienTheSanPham?.mauSac?.tenMau}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md border border-bo-border bg-slate-100 px-2 text-xs font-semibold text-bo-foreground">
                                        {item.bienTheSanPham?.size?.maSize}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-blue-200 bg-bo-primary-soft px-3 font-bold text-bo-primary">
                                        {item.soLuongDat}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {(orderData.chiTietYeuCauMuaHangs || []).length === 0 && (
                            <tr>
                                <td colSpan={4}>
                                    <EmptyState
                                        icon={Package}
                                        title="Yêu cầu này không có sản phẩm nào"
                                        description="Yêu cầu mua hàng gốc chưa có chi tiết sản phẩm."
                                        className="min-h-0 py-10"
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </TableShell>

            {/* ── Table 2: Các Báo giá từ Nhà Cung Cấp ── */}
            <TableShell
                title="Danh sách báo giá từ nhà cung cấp"
                description="Bấm vào dòng để mở chi tiết báo giá tương ứng."
                toolbar={
                    <div className="flex items-center gap-2 border-b border-bo-border px-4 py-2.5 sm:px-5">
                        <ListChecks className="size-4 text-bo-primary" />
                        <span className="text-xs font-medium text-bo-muted">
                            {orderData.donMuaHangs?.length || 0} báo giá
                        </span>
                    </div>
                }
            >
                <table className="w-full min-w-[980px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-10 w-[160px] px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mã báo giá</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Nhà cung cấp</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày gửi</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Hạn chót</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                            <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền (NCC báo)</th>
                            <th className="h-10 w-[140px] px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {orderData.donMuaHangs?.length > 0 ? (
                            orderData.donMuaHangs.map((po) => {
                                const cfg = PO_STATUS[po.trangThai] ?? { label: 'Không rõ', tone: 'neutral', icon: Clock };
                                const isAccepted = po.trangThai === 3 || po.trangThai === 5;
                                const canPay = po.trangThai === 3;

                                return (
                                    <tr key={po.id} className="cursor-pointer transition-colors hover:bg-bo-surface-subtle" onClick={() => navigate(`/quotation/${po.id}`)}>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="size-1.5 shrink-0 rounded-full bg-bo-primary" />
                                                <span className="text-[13px] font-semibold text-bo-foreground">{po.soDonMua?.replace(/^PO/, 'Q-')}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="text-sm font-semibold text-bo-foreground">{po.nhaCungCap?.tenNhaCungCap}</p>
                                            <p className="mt-0.5 font-mono text-xs text-bo-muted">{po.nhaCungCap?.maNhaCungCap}</p>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 text-[13px] font-medium text-bo-muted">
                                                <Calendar className="size-3.5 shrink-0" /> {formatDate(po.ngayDatHang)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 text-[13px] font-medium text-bo-muted">
                                                <Calendar className="size-3.5 shrink-0" /> {formatDate(po.ngayGiaoDuKien)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge label={cfg.label} tone={cfg.tone} />
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className={`text-[15px] font-bold ${isAccepted ? 'text-bo-success' : 'text-bo-foreground'}`}>
                                                {formatCurrency(po.tongTien)}
                                            </span>
                                            {isAccepted && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-bo-success">Đã chốt</p>}
                                        </td>
                                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                            <TooltipProvider>
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="size-8 text-bo-muted hover:bg-bo-primary-soft hover:text-bo-primary"
                                                                onClick={() => navigate(`/quotation/${po.id}`)}>
                                                                <Eye className="size-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Xem chi tiết báo giá</p></TooltipContent>
                                                    </Tooltip>

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span tabIndex={canPay ? undefined : 0}>
                                                                <Button variant="ghost" size="icon" className="size-8 hover:bg-bo-primary-soft hover:text-bo-primary"
                                                                    disabled={!canPay}
                                                                    onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/${po.id}/payment`); }}>
                                                                    <CreditCard className={`size-4 ${canPay ? 'text-bo-primary' : 'text-slate-300'}`} />
                                                                </Button>
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>{getPaymentTooltip(po.trangThai)}</p></TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TooltipProvider>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={7}>
                                    <EmptyState
                                        icon={FileText}
                                        title="Chưa có báo giá nào từ nhà cung cấp"
                                        description="Các báo giá sẽ xuất hiện sau khi nhà cung cấp phản hồi yêu cầu."
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </TableShell>

            {/* ── Accept Dialog ── */}
            <AlertDialog open={acceptDialog} onOpenChange={(open) => !open && setAcceptDialog(false)}>
                <AlertDialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-white p-5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bo-success-soft text-bo-success">
                            <CheckCircle className="size-5" />
                        </div>
                        <AlertDialogTitle className="m-0 text-lg font-semibold text-bo-foreground">Xác nhận chấp nhận báo giá</AlertDialogTitle>
                    </div>
                    <div className="bg-white p-5">
                        <AlertDialogDescription className="mb-5 text-sm leading-6 text-slate-600">
                            Bạn có chắc chắn muốn chấp nhận báo giá cho đơn hàng này?
                            Hành động này sẽ chốt mức giá và nhà cung cấp sẽ tiến hành giao hàng.
                        </AlertDialogDescription>
                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel disabled={actionLoading} onClick={() => { setAcceptDialog(false); setApprovingPo(null); }}
                                className="m-0 h-10 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle">Hủy bỏ</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handlePoAction(approvingPo, 3)} disabled={actionLoading}
                                className="m-0 h-10 gap-2 bg-bo-success font-semibold text-white hover:bg-bo-success/90">
                                {actionLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                                Chấp nhận báo giá
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Reject Dialog ── */}
            <AlertDialog open={rejectDialog} onOpenChange={(open) => !open && setRejectDialog(false)}>
                <AlertDialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-white p-5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bo-danger-soft text-bo-danger">
                            <XCircle className="size-5" />
                        </div>
                        <AlertDialogTitle className="m-0 text-lg font-semibold text-bo-foreground">Từ chối báo giá</AlertDialogTitle>
                    </div>
                    <div className="bg-white p-5">
                        <AlertDialogDescription className="mb-4 text-sm leading-6 text-slate-600">
                            Bạn đang từ chối báo giá của đơn hàng này. Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                        <div className="mb-5">
                            <Label htmlFor="rejectReason" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                Lý do từ chối <span className="text-bo-danger">*</span>
                            </Label>
                            <Textarea
                                id="rejectReason"
                                placeholder="Nhập lý do (VD: Giá quá cao, không đúng yêu cầu...)"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="min-h-[100px] resize-y rounded-md border-bo-border bg-white p-3 text-sm text-bo-foreground focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15"
                            />
                        </div>
                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel disabled={actionLoading} onClick={() => { setRejectDialog(false); setRejectReason(''); setApprovingPo(null); }}
                                className="m-0 h-10 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle">Hủy bỏ</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handlePoAction(approvingPo, 4)} disabled={actionLoading}
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
