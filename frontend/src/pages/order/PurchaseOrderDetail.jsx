import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ArrowLeft, Building2, Warehouse, Calendar, User, FileText, Package,
    Printer, Phone, Mail, MapPin, Clock, CreditCard, DollarSign,
    PackagePlus,
} from 'lucide-react';

import apiClient from '@/services/apiClient';

import PageContainer from '@/components/backoffice/PageContainer';
import PageHeader from '@/components/backoffice/PageHeader';
import SurfaceCard from '@/components/shared/SurfaceCard';
import TableShell from '@/components/shared/TableShell';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';

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

// ─── Status configs ────────────────────────────────────────────────────────────
const PO_STATUS = {
    3: { label: 'Đang vận chuyển', tone: 'warning', icon: Clock, desc: 'Đơn hàng đang chờ nhà cung cấp vận chuyển đến kho.' },
    5: { label: 'Đã thanh toán', tone: 'success', icon: CreditCard, desc: 'Đơn hàng đã được thanh toán hoàn tất.' },
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
function InfoField({ label, value, mono = false, icon, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                {icon}
                {label}
            </div>
            <div className="mt-0.5 flex flex-1 items-start">
                {children ?? (
                    <p className={`text-sm font-semibold text-bo-foreground ${mono ? "font-mono font-bold tracking-tight" : ""}`}>
                        {value || "—"}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function PurchaseOrderDetail() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [orderData, setOrderData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [userRoles, setUserRoles] = useState([]);
    const [loadingAuth, setLoadingAuth] = useState(true);

    const fetchOrderDetail = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiClient.get(`/api/v1/don-mua-hang/get-by-id/${id}`);
            if (result && result.data?.data) {
                setOrderData(result.data.data);
            }
        } catch (error) {
            console.error('Error fetching PO detail:', error);
            toast.error('Không thể tải chi tiết đơn mua hàng');
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
        };
        fetchUserInfo();
    }, []);

    const handlePrint = () => navigate(`/purchase-orders/${id}/print`);

    if (loading) {
        return (
            <PageContainer>
                <SurfaceCard title="Chi tiết đơn mua hàng" description="Đang tải dữ liệu">
                    <LoadingState rows={4} label="Đang tải dữ liệu đơn hàng" />
                </SurfaceCard>
            </PageContainer>
        );
    }

    if (!orderData) {
        return (
            <PageContainer>
                <SurfaceCard contentClassName="p-0 sm:p-0">
                    <ErrorState
                        title="Không tìm thấy đơn mua hàng"
                        description="Đơn mua hàng không tồn tại hoặc đã bị xóa khỏi hệ thống."
                    />
                    <div className="flex justify-center pb-10">
                        <Button
                            onClick={() => navigate('/purchase-orders')}
                            className="h-10 bg-bo-primary px-5 font-semibold text-white hover:bg-bo-primary-hover"
                        >
                            Quay lại danh sách
                        </Button>
                    </div>
                </SurfaceCard>
            </PageContainer>
        );
    }

    const currentStatus = PO_STATUS[orderData.trangThai] || { label: 'Không rõ', tone: 'neutral', icon: Clock, desc: '' };
    const StatusIcon = currentStatus.icon;
    const bannerClass = BANNER_TONES[currentStatus.tone] || BANNER_TONES.neutral;

    // Phân quyền hiển thị nút
    const canCreateReceipt = userRoles.includes(ROLE.QUAN_TRI_VIEN) || userRoles.includes(ROLE.QUAN_LY_KHO) || userRoles.includes(ROLE.NHAN_VIEN_KHO);

    // Kiểm tra xem đã nhận đủ hàng chưa
    const isFullyReceived = orderData.chiTietDonMuaHangs?.every(
        ct => (ct.soLuongDaNhan || 0) >= (ct.soLuongDat || 0)
    ) && orderData.chiTietDonMuaHangs?.length > 0;

    return (
        <PageContainer className="space-y-5">
            <PageHeader
                eyebrow="Mua hàng"
                title={orderData.soDonMua || '—'}
                description="Chi tiết đơn mua hàng, tình trạng nhận hàng và thanh toán."
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
                            onClick={handlePrint}
                            className="gap-1.5 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <Printer className="size-4" /> In đơn hàng
                        </Button>

                        {/* ── Action Buttons ── */}
                        {!loadingAuth && (
                            <TooltipProvider>
                                <div className="flex items-center gap-2">
                                    {orderData.trangThai === 3 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    className="gap-1.5 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                                                    onClick={() => navigate(`/purchase-orders/${orderData.id}/payment`)}
                                                >
                                                    <CreditCard className="size-4" /> Thanh toán
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Thanh toán cho nhà cung cấp</p></TooltipContent>
                                        </Tooltip>
                                    )}

                                    {canCreateReceipt && (orderData.trangThai === 3 || orderData.trangThai === 5) && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span>
                                                    <Button
                                                        className="gap-1.5 bg-bo-success font-semibold text-white hover:bg-bo-success/90 disabled:cursor-not-allowed disabled:opacity-50"
                                                        disabled={isFullyReceived}
                                                        onClick={() => navigate(`/goods-receipts/create?poId=${orderData.id}`)}
                                                    >
                                                        <PackagePlus className="size-4" /> Tạo phiếu nhập kho
                                                    </Button>
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent><p>{isFullyReceived ? 'Đã nhập đủ số lượng hàng' : 'Tiến hành nhập hàng vào kho'}</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                            </TooltipProvider>
                        )}
                    </>
                }
            />

            {/* ── Status Banner ── */}
            <div className={`flex flex-col items-start justify-between gap-5 rounded-lg border p-4 shadow-sm sm:p-5 md:flex-row md:items-center ${bannerClass}`}>
                <div className="flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-white/60 bg-white/70 text-bo-foreground">
                        <StatusIcon className="size-6" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold tracking-tight text-bo-foreground sm:text-xl">{currentStatus.label}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{currentStatus.desc}</p>
                    </div>
                </div>

                <div className="ml-auto min-w-[220px] rounded-lg border border-white/60 bg-white/80 px-5 py-3 text-right">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền cần thanh toán</p>
                    <p className={`text-xl font-bold tracking-tight sm:text-2xl ${orderData.trangThai === 5 ? 'text-bo-success' : 'text-bo-primary'}`}>
                        {formatCurrency(orderData.tongTien)}
                    </p>
                </div>
            </div>

            {/* ── Info Cards Grid ── */}
            <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
                <SurfaceCard title="Thông tin đơn hàng">
                    <InfoField label="Ngày tạo đơn" icon={<Calendar className="size-3.5" />}>
                        <span className="font-semibold text-bo-foreground">{formatDateTime(orderData.ngayTao)}</span>
                    </InfoField>
                    <div className="mt-4">
                        <InfoField label="Ngày giao dự kiến" icon={<Clock className="size-3.5" />}>
                            <span className="font-semibold text-bo-foreground">{formatDate(orderData.ngayGiaoDuKien)}</span>
                        </InfoField>
                    </div>
                    <div className="my-4 border-t border-bo-border" />
                    <InfoField label="Yêu cầu mua hàng gốc" icon={<FileText className="size-3.5" />}>
                        {orderData.yeuCauMuaHang?.soYeuCauMuaHang ? (
                            <span
                                className="cursor-pointer font-semibold text-bo-primary hover:underline"
                                onClick={() => navigate(`/purchase-requests/${orderData.yeuCauMuaHang?.id}`)}
                            >
                                {orderData.yeuCauMuaHang.soYeuCauMuaHang}
                            </span>
                        ) : (
                            <span className="italic text-bo-muted">Không có dữ liệu</span>
                        )}
                    </InfoField>
                </SurfaceCard>

                <SurfaceCard title="Nhà cung cấp">
                    {orderData.nhaCungCap ? (
                        <>
                            <InfoField label="Tên nhà cung cấp">
                                <div className="font-semibold text-bo-foreground">{orderData.nhaCungCap.tenNhaCungCap}</div>
                                <div className="mt-1">
                                    <span className="inline-flex rounded border border-blue-200 bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">
                                        {orderData.nhaCungCap.maNhaCungCap}
                                    </span>
                                </div>
                            </InfoField>
                            <div className="my-4 border-t border-bo-border" />
                            <div className="space-y-4">
                                <InfoField label="Người liên hệ" icon={<User className="size-3.5" />} value={orderData.nhaCungCap.nguoiLienHe} />
                                <InfoField label="Số điện thoại" icon={<Phone className="size-3.5" />} mono value={orderData.nhaCungCap.soDienThoai} />
                                <InfoField label="Email" icon={<Mail className="size-3.5" />} value={orderData.nhaCungCap.email} />
                            </div>
                        </>
                    ) : (
                        <EmptyState
                            icon={Building2}
                            title="Không có thông tin"
                            description="Đơn mua hàng chưa gắn nhà cung cấp."
                            className="min-h-0 py-6"
                        />
                    )}
                </SurfaceCard>

                <SurfaceCard title="Kho tiếp nhận & phụ trách">
                    <InfoField label="Tên kho nhận hàng">
                        <div className="font-semibold text-bo-foreground">{orderData.khoNhap?.tenKho || '—'}</div>
                        {orderData.khoNhap?.maKho && (
                            <div className="mt-1">
                                <span className="inline-flex rounded border border-orange-200 bg-bo-warning-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-warning">
                                    {orderData.khoNhap.maKho}
                                </span>
                            </div>
                        )}
                    </InfoField>
                    <div className="my-4 border-t border-bo-border" />
                    <div className="space-y-4">
                        <InfoField label="Địa chỉ kho" icon={<MapPin className="size-3.5" />}>
                            <span className="block text-sm leading-6 text-slate-700">{orderData.khoNhap?.diaChi || "—"}</span>
                        </InfoField>
                        <InfoField label="Người phụ trách tạo đơn" icon={<User className="size-3.5" />}>
                            <div className="font-semibold text-bo-foreground">{orderData.nguoiTao?.hoTen || '—'}</div>
                            <div className="mt-0.5 text-[13px] text-bo-muted">{orderData.nguoiTao?.email}</div>
                        </InfoField>
                    </div>
                </SurfaceCard>
            </div>

            {/* ── Product Table ── */}
            <TableShell
                title="Danh sách sản phẩm đặt mua"
                description="Số lượng đặt, số lượng đã nhận và đơn giá từng biến thể."
                footer={
                    <div className="flex justify-end">
                        <div className="w-full space-y-4 sm:w-96">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-bo-muted">Tổng số lượng đặt:</span>
                                <span className="text-base font-bold text-bo-foreground">
                                    {orderData.chiTietDonMuaHangs?.reduce((sum, item) => sum + item.soLuongDat, 0) || 0}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-bo-border bg-bo-surface-subtle px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="size-4 text-bo-primary" />
                                    <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">Tổng cộng:</span>
                                </div>
                                <span className="text-xl font-bold text-bo-primary">
                                    {formatCurrency(orderData.tongTien)}
                                </span>
                            </div>
                        </div>
                    </div>
                }
            >
                <table className="w-full min-w-[960px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-10 w-[350px] px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Màu sắc</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kích cỡ</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL đặt</th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL đã nhận</th>
                            <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đơn giá</th>
                            <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {orderData.chiTietDonMuaHangs?.length > 0 ? (
                            orderData.chiTietDonMuaHangs.map((item, index) => {
                                const isItemReceived = (item.soLuongDaNhan || 0) >= item.soLuongDat;
                                return (
                                    <tr key={item.id || index} className="transition-colors hover:bg-bo-surface-subtle">
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-3">
                                                {item.bienTheSanPham?.anhBienThe?.tepTin?.duongDan ? (
                                                    <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-bo-border bg-slate-100">
                                                        <img
                                                            src={item.bienTheSanPham.anhBienThe.tepTin.duongDan}
                                                            alt="Ảnh sản phẩm"
                                                            className="size-full object-cover"
                                                        />
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
                                                <span
                                                    className="size-4 rounded-full border border-bo-border"
                                                    style={{ backgroundColor: item.bienTheSanPham?.mauSac?.maMauHex }}
                                                    title={item.bienTheSanPham?.mauSac?.tenMau}
                                                />
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
                                        <td className="px-3 py-3 text-center">
                                            <span className={`inline-flex h-7 min-w-10 items-center justify-center rounded-md border px-3 font-semibold ${isItemReceived ? 'border-green-200 bg-bo-success-soft text-bo-success' : 'border-orange-200 bg-bo-warning-soft text-bo-warning'}`}>
                                                {item.soLuongDaNhan || 0}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right text-[15px] font-semibold text-bo-foreground">
                                            {formatCurrency(item.donGia)}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className="text-base font-bold text-bo-foreground">
                                                {formatCurrency(item.thanhTien)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={7}>
                                    <EmptyState
                                        icon={Package}
                                        title="Chưa có sản phẩm nào"
                                        description="Đơn mua hàng chưa có chi tiết sản phẩm."
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </TableShell>
        </PageContainer>
    );
}
