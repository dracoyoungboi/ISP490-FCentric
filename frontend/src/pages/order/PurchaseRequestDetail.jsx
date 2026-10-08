import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle,
} from "@/components/ui/dialog";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ArrowLeft, Warehouse, Calendar, User, FileText, Package,
    CheckCircle, XCircle, Printer, AlertCircle,
    MapPin, Clock, Send,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";

import purchaseRequestService from '@/services/purchaseRequestService';
import apiClient from '@/services/apiClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
};

// Phê duyệt/Từ chối: Chỉ Quản trị viên và Quản lý kho
const APPROVE_ROLES = [ROLE.QUAN_TRI_VIEN, ROLE.QUAN_LY_KHO];
// Gửi báo giá: Quản trị viên và Nhân viên mua hàng
const QUOTATION_ROLES = [ROLE.QUAN_TRI_VIEN, ROLE.NHAN_VIEN_MUA_HANG];

function parseJwt(token) {
    try {
        const b64 = token.split(".")[1];
        return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    } catch { return null; }
}

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

// ── Shared components ──────────────────────────────────────────────────────────
function InfoField({ label, value, mono = false, icon, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                {icon}
                {label}
            </div>
            {/* flex-col: các dòng con (tên / email / thời điểm, tên kho / mã kho)
                xếp dọc — trước đây xếp ngang nên bị dính liền nhau */}
            <div className="flex flex-1 flex-col items-start">
                {children ?? (
                    <p className={`text-sm font-semibold text-bo-foreground ${mono ? "font-mono tracking-tight" : ""}`}>
                        {value || "—"}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function PurchaseRequestDetail() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [requestData, setRequestData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [approveDialog, setApproveDialog] = useState(false);
    const [rejectDialog, setRejectDialog] = useState(false);
    // Lý do từ chối — bắt buộc (SRS 4.3.4), tối đa 500 ký tự (backend cũng chặn)
    const [lyDoTuChoi, setLyDoTuChoi] = useState('');
    const LY_DO_MAX = 500;

    const [userRoles, setUserRoles] = useState([]);
    const [loadingAuth, setLoadingAuth] = useState(true);

    const statusConfig = {
        1: {
            label: 'Chờ duyệt',
            bannerBg: 'bg-bo-warning-soft', bannerBorder: 'border-bo-warning/30',
            iconBg: 'bg-white', iconColor: 'text-bo-warning', textColor: 'text-bo-foreground',
            icon: Clock, description: 'Yêu cầu đang chờ quản lý kho phê duyệt'
        },
        2: {
            label: 'Đã duyệt',
            bannerBg: 'bg-bo-success-soft', bannerBorder: 'border-bo-success/30',
            iconBg: 'bg-white', iconColor: 'text-bo-success', textColor: 'text-bo-foreground',
            icon: CheckCircle, description: 'Yêu cầu đã được duyệt — có thể gửi yêu cầu báo giá'
        },
        3: {
            label: 'Đã chuyển thành báo giá',
            bannerBg: 'bg-bo-primary-soft', bannerBorder: 'border-bo-primary/30',
            iconBg: 'bg-white', iconColor: 'text-bo-primary', textColor: 'text-bo-foreground',
            icon: FileText, description: 'Yêu cầu này đã được tạo thành đơn báo giá'
        },
        4: {
            label: 'Từ chối',
            bannerBg: 'bg-bo-danger-soft', bannerBorder: 'border-bo-danger/30',
            iconBg: 'bg-white', iconColor: 'text-bo-danger', textColor: 'text-bo-foreground',
            icon: XCircle, description: 'Yêu cầu nhập hàng đã bị từ chối'
        },
        5: {
            label: 'Đã chuyển thành báo giá',
            bannerBg: 'bg-bo-primary-soft', bannerBorder: 'border-bo-primary/30',
            iconBg: 'bg-white', iconColor: 'text-bo-primary', textColor: 'text-bo-foreground',
            icon: FileText, description: 'Yêu cầu này đã được tạo thành đơn báo giá'
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const fetchRequestDetail = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiClient.get(`/api/v1/yeu-cau-mua-hang/get-by-id/${id}`);
            if (result && result.data && result.data.data) {
                setRequestData(result.data.data);
            }
        } catch (error) {
            console.error('Error fetching request detail:', error);
            toast.error('Không thể tải chi tiết yêu cầu mua hàng');
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchUserInfo = useCallback(async () => {
        try {
            setLoadingAuth(true);
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
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch ngay khi mount / khi id đổi.
    useEffect(() => {
        if (id) queueMicrotask(() => fetchRequestDetail());
    }, [id, fetchRequestDetail]);

    useEffect(() => { queueMicrotask(() => fetchUserInfo()); }, [fetchUserInfo]);

    const handleAction = async (trangThai) => {
        const lyDo = lyDoTuChoi.trim();
        if (trangThai === 4 && !lyDo) {
            toast.error('Vui lòng nhập lý do từ chối');
            return;
        }
        setActionLoading(true);
        try {
            await purchaseRequestService.approve(id, trangThai, lyDo);
            const ma = requestData?.soYeuCauMuaHang || `#${id}`;
            toast.success(trangThai === 2 ? `Đã phê duyệt yêu cầu ${ma}!` : `Đã từ chối yêu cầu ${ma}!`);
            setApproveDialog(false);
            setRejectDialog(false);
            setLyDoTuChoi('');
            await fetchRequestDetail();
        } catch (error) {
            console.error('Error action:', error);
            toast.error(error.response?.data?.message || 'Không thể thực hiện thao tác. Vui lòng thử lại!');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendQuotationRequest = () => {
        navigate(`/purchase-requests/${id}/send-quotation`);
    };

    const handlePrint = () => navigate(`/purchase-requests/${id}/print`);

    if (loading) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState rows={5} label="Đang tải dữ liệu yêu cầu" />
                </div>
            </PageContainer>
        );
    }

    if (!requestData) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <EmptyState
                        icon={AlertCircle}
                        title="Không tìm thấy yêu cầu nhập hàng"
                        description="Yêu cầu có thể đã bị xoá hoặc bạn không có quyền truy cập."
                        action={
                            <Button
                                onClick={() => navigate('/purchase-requests')}
                                className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                            >
                                Quay lại danh sách
                            </Button>
                        }
                    />
                </div>
            </PageContainer>
        );
    }

    const currentStatus = statusConfig[requestData.trangThai] || statusConfig[1];
    const StatusIcon = currentStatus.icon;

    // Kiểm tra quyền
    const canApprove = APPROVE_ROLES.some(role => userRoles.includes(role));
    const canCreateQuotation = QUOTATION_ROLES.some(role => userRoles.includes(role));

    return (
        <PageContainer className="space-y-5 pb-24">

            {/* ── Header ── */}
            <PageHeader
                title="Chi tiết yêu cầu nhập hàng"
                description="Thông tin yêu cầu, kho nhập và danh sách biến thể cần mua"
                actions={
                    <>
                        <Button
                            variant="outline"
                            className="h-10 gap-1.5 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle"
                            onClick={() => navigate("/purchase-requests")}
                        >
                            <ArrowLeft className="size-4" /> Quay lại danh sách
                        </Button>
                        <Button variant="outline" className="h-10 gap-1.5 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle" onClick={handlePrint}>
                            <Printer className="size-4 text-bo-muted" /> In yêu cầu
                        </Button>

                        {/* ── Action Buttons ── */}
                        <TooltipProvider>
                            <div className="flex items-center justify-center gap-2">
                                {/* Chờ duyệt (1) */}
                                {requestData.trangThai === 1 && (
                                    <>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span>
                                                    <Button variant="outline" className="h-10 gap-1.5 border-bo-danger/30 bg-bo-danger-soft font-semibold text-bo-danger hover:bg-bo-danger/15 disabled:opacity-50"
                                                        disabled={!canApprove || loadingAuth}
                                                        onClick={() => canApprove && !loadingAuth && setRejectDialog(true)}>
                                                        <XCircle className="size-4" /> Từ chối
                                                    </Button>
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="border-bo-border bg-white text-bo-foreground shadow-lg"><p>{!canApprove ? "Bạn không có quyền thao tác" : "Từ chối yêu cầu nhập hàng"}</p></TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span>
                                                    <Button className="h-10 gap-1.5 bg-bo-success font-semibold text-white hover:bg-bo-success/90 disabled:opacity-50"
                                                        disabled={!canApprove || loadingAuth}
                                                        onClick={() => canApprove && !loadingAuth && setApproveDialog(true)}>
                                                        <CheckCircle className="size-4" /> Phê duyệt
                                                    </Button>
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="border-bo-border bg-white text-bo-foreground shadow-lg"><p>{!canApprove ? "Bạn không có quyền duyệt" : "Duyệt yêu cầu nhập hàng"}</p></TooltipContent>
                                        </Tooltip>
                                    </>
                                )}

                                {/* Đã duyệt (2) */}
                                {requestData.trangThai === 2 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button className="h-10 gap-1.5 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                                                    disabled={loadingAuth || !canCreateQuotation}
                                                    onClick={() => !loadingAuth && canCreateQuotation && handleSendQuotationRequest()}>
                                                    <Send className="size-4" /> Gửi báo giá
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="border-bo-border bg-white text-bo-foreground shadow-lg"><p>{!canCreateQuotation ? "Chỉ nhân viên mua hàng có quyền thao tác" : "Tạo đơn báo giá từ yêu cầu này"}</p></TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </TooltipProvider>
                    </>
                }
            />

            {/* ── Status Banner ── */}
            <div className={`flex flex-col items-start justify-between gap-5 rounded-lg border p-5 sm:flex-row sm:items-center sm:p-6 ${currentStatus.bannerBg} ${currentStatus.bannerBorder}`}>
                <div className="flex items-center gap-4">
                    <div className={`flex size-14 shrink-0 items-center justify-center rounded-lg border border-bo-border ${currentStatus.iconBg}`}>
                        <StatusIcon className={`size-7 ${currentStatus.iconColor}`} />
                    </div>
                    <div>
                        <h2 className={`text-lg font-semibold tracking-tight sm:text-xl ${currentStatus.textColor}`}>{currentStatus.label}</h2>
                        <p className={`mt-1 text-sm font-medium opacity-80 ${currentStatus.textColor}`}>{currentStatus.description}</p>
                        {requestData.trangThai === 4 && requestData.lyDoTuChoi ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-bo-foreground">
                                <span className="font-semibold">Lý do từ chối:</span> {requestData.lyDoTuChoi}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ── Info Cards Grid ── */}
            <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
                <SurfaceCard
                    title={<span className="flex items-center gap-2"><FileText className="size-4 text-bo-primary" />Thông tin yêu cầu</span>}
                >
                    <InfoField label="Mã yêu cầu" mono value={requestData.soYeuCauMuaHang || `#${requestData.id}`} />
                    <InfoField label="Ngày tạo yêu cầu" icon={<Calendar className="size-3.5 opacity-70" />}>
                        <span className="text-sm font-semibold text-bo-foreground">{formatDateTime(requestData.ngayTao)}</span>
                    </InfoField>
                    <InfoField label="Ngày giao dự kiến" icon={<Clock className="size-3.5 opacity-70" />}>
                        <span className="text-sm font-semibold text-bo-foreground">{formatDate(requestData.ngayGiaoDuKien)}</span>
                    </InfoField>
                    <Separator className="my-4 bg-bo-border" />
                    <InfoField label="Ghi chú">
                        <span className="mt-1 block rounded-md border border-bo-border bg-bo-surface-subtle p-3 text-sm leading-relaxed text-slate-600">
                            {requestData.ghiChu || <span className="italic text-bo-muted">Không có ghi chú</span>}
                        </span>
                    </InfoField>
                </SurfaceCard>

                <SurfaceCard
                    title={<span className="flex items-center gap-2"><Warehouse className="size-4 text-bo-primary" />Kho nhập hàng</span>}
                >
                    <InfoField label="Tên kho">
                        <div className="text-sm font-semibold text-bo-foreground">{requestData.khoNhap?.tenKho || '—'}</div>
                        {requestData.khoNhap?.maKho && (
                            <div className="mt-1">
                                <span className="inline-flex rounded border border-bo-border bg-bo-surface-subtle px-2 py-0.5 font-mono text-xs font-semibold text-bo-foreground">
                                    {requestData.khoNhap.maKho}
                                </span>
                            </div>
                        )}
                    </InfoField>
                    <Separator className="my-4 bg-bo-border" />
                    <InfoField label="Người quản lý kho" icon={<User className="size-3.5 opacity-70" />} value={requestData.khoNhap?.quanLy?.hoTen || '—'} />
                    <InfoField label="Địa chỉ" icon={<MapPin className="size-3.5 opacity-70" />}>
                        <span className="line-clamp-2 block text-sm leading-snug text-slate-600">{requestData.khoNhap?.diaChi || "—"}</span>
                    </InfoField>
                </SurfaceCard>

                <SurfaceCard
                    title={<span className="flex items-center gap-2"><User className="size-4 text-bo-primary" />Thông tin người dùng</span>}
                >
                    <InfoField label="Người tạo" icon={<CheckCircle className="size-3.5 opacity-70" />}>
                        <div className="text-sm font-semibold text-bo-foreground">{requestData.nguoiTao?.hoTen || '—'}</div>
                        <div className="mt-0.5 text-[13px] text-bo-muted">{requestData.nguoiTao?.email}</div>
                    </InfoField>
                    {requestData.nguoiDuyet && (
                        <>
                            <Separator className="my-4 bg-bo-border" />
                            <InfoField
                                label={requestData.trangThai === 4 ? "Người từ chối" : "Người duyệt"}
                                icon={requestData.trangThai === 4
                                    ? <XCircle className="size-3.5 opacity-70" />
                                    : <CheckCircle className="size-3.5 opacity-70" />}
                            >
                                <div className="text-sm font-semibold text-bo-foreground">{requestData.nguoiDuyet?.hoTen}</div>
                                <div className="mt-0.5 text-[13px] text-bo-muted">{requestData.nguoiDuyet?.email}</div>
                                {requestData.ngayDuyet ? (
                                    <div className="mt-0.5 text-[13px] text-bo-muted">{formatDateTime(requestData.ngayDuyet)}</div>
                                ) : null}
                            </InfoField>
                        </>
                    )}
                </SurfaceCard>
            </div>

            {/* ── Product Table ── */}
            <TableShell
                title="Danh sách sản phẩm"
                footer={
                    <div className="flex justify-end">
                        <div className="flex w-full items-center justify-between rounded-md border border-bo-border bg-white px-4 py-3 sm:w-80">
                            <span className="text-[13px] font-semibold uppercase tracking-wide text-bo-muted">Tổng số lượng SP:</span>
                            <span className="text-base font-bold text-bo-foreground">
                                {requestData.chiTietYeuCauMuaHangs?.reduce((sum, item) => sum + item.soLuongDat, 0) || 0}
                            </span>
                        </div>
                    </div>
                }
            >
                <table className="w-full min-w-[900px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-11 w-[350px] px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                            <th className="h-11 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Màu sắc</th>
                            <th className="h-11 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Size</th>
                            <th className="h-11 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Chất liệu</th>
                            <th className="h-11 px-3 pr-6 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL Yêu cầu</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {requestData.chiTietYeuCauMuaHangs?.length > 0 ? (
                            requestData.chiTietYeuCauMuaHangs.map((item, index) => (
                                <tr key={item.id || index} className="transition-colors hover:bg-bo-surface-subtle">
                                    <td className="px-3 py-4">
                                        <div className="flex items-center gap-4">
                                            {item.bienTheSanPham?.anhBienThe?.tepTin?.duongDan ? (
                                                <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-bo-border bg-bo-surface-subtle">
                                                    <img src={item.bienTheSanPham.anhBienThe.tepTin.duongDan} alt="Product"
                                                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                                                </div>
                                            ) : (
                                                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-bo-border bg-bo-surface-subtle">
                                                    <Package className="size-6 text-slate-300" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-[15px] font-semibold leading-tight text-bo-foreground">{item.bienTheSanPham?.tenSanPham || item.bienTheSanPham?.maSku}</p>
                                                <p className="mt-1 flex items-center gap-1 text-[13px] font-medium uppercase tracking-wide text-bo-muted">
                                                    Mã: <span className="rounded bg-bo-surface-subtle px-1 py-0.5 font-mono text-slate-700">{item.bienTheSanPham?.maSku}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="size-5 rounded-full border border-bo-border"
                                                style={{ backgroundColor: item.bienTheSanPham?.mauSac?.maMauHex }}
                                                title={item.bienTheSanPham?.mauSac?.tenMau} />
                                            <span className="text-sm font-medium text-slate-700">{item.bienTheSanPham?.mauSac?.tenMau}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-md border border-bo-border bg-bo-surface-subtle px-2 text-[13px] font-semibold text-bo-foreground">
                                            {item.bienTheSanPham?.size?.maSize}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-center text-sm font-medium text-slate-600">
                                        {item.bienTheSanPham?.chatLieu?.tenChatLieu}
                                    </td>
                                    <td className="px-3 py-4 pr-6 text-center">
                                        <span className="inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-md border border-bo-primary/30 bg-bo-primary-soft px-3 font-semibold text-bo-primary">
                                            {item.soLuongDat}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-4 py-14 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="flex size-16 items-center justify-center rounded-full border border-bo-border bg-bo-surface-subtle">
                                            <Package className="size-8 text-slate-300" />
                                        </div>
                                        <p className="font-medium text-bo-muted">Chưa có sản phẩm nào</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </TableShell>

            {/* ── Approve Dialog ── */}
            <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
                <DialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-bo-success-soft px-5 py-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-bo-success">
                            <CheckCircle className="size-5" />
                        </div>
                        <DialogTitle className="m-0 text-base font-semibold text-bo-foreground">Xác nhận phê duyệt</DialogTitle>
                    </div>
                    <div className="p-5">
                        <DialogDescription className="mb-5 text-sm leading-relaxed text-bo-muted">
                            Bạn có chắc chắn muốn phê duyệt yêu cầu nhập hàng <span className="font-semibold text-bo-foreground">{requestData.soYeuCauMuaHang || `#${requestData.id}`}</span>?
                            Sau khi duyệt, nhân viên mua hàng có thể tạo đơn báo giá.
                        </DialogDescription>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setApproveDialog(false)} disabled={actionLoading}
                                className="h-11 rounded-md border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle">Hủy bỏ</Button>
                            <Button onClick={() => handleAction(2)} disabled={actionLoading}
                                className="h-11 rounded-md bg-bo-success font-semibold text-white hover:bg-bo-success/90">
                                {actionLoading ? 'Đang xử lý...' : 'Xác nhận phê duyệt'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Reject Dialog ── */}
            <Dialog
                open={rejectDialog}
                onOpenChange={(open) => {
                    setRejectDialog(open);
                    if (!open) setLyDoTuChoi('');
                }}
            >
                <DialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-bo-danger-soft px-5 py-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-bo-danger">
                            <XCircle className="size-5" />
                        </div>
                        <DialogTitle className="m-0 text-base font-semibold text-bo-foreground">Từ chối yêu cầu</DialogTitle>
                    </div>
                    <div className="p-5">
                        <DialogDescription className="mb-4 text-sm leading-relaxed text-bo-muted">
                            Bạn có chắc chắn muốn từ chối yêu cầu nhập hàng <span className="font-semibold text-bo-foreground">{requestData.soYeuCauMuaHang || `#${requestData.id}`}</span>? Hành động này không thể hoàn tác.
                        </DialogDescription>
                        <label htmlFor="ly-do-tu-choi" className="mb-1.5 block text-sm font-medium text-bo-foreground">
                            Lý do từ chối <span className="text-bo-danger">*</span>
                        </label>
                        <Textarea
                            id="ly-do-tu-choi"
                            value={lyDoTuChoi}
                            onChange={(event) => setLyDoTuChoi(event.target.value.slice(0, LY_DO_MAX))}
                            placeholder="Ví dụ: Tồn kho hiện tại còn đủ cho 2 tuần tới"
                            rows={3}
                            className="border-bo-border bg-white text-bo-foreground"
                            disabled={actionLoading}
                        />
                        <p className="mb-5 mt-1 text-right text-xs text-bo-muted">
                            {lyDoTuChoi.length}/{LY_DO_MAX}
                        </p>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setRejectDialog(false)} disabled={actionLoading}
                                className="h-11 rounded-md border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle">Hủy bỏ</Button>
                            <Button onClick={() => handleAction(4)} disabled={actionLoading || !lyDoTuChoi.trim()}
                                className="h-11 rounded-md bg-bo-danger font-semibold text-white hover:bg-bo-danger/90">
                                {actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
