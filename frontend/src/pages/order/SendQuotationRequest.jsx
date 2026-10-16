import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/lib/thongBaoNhanh';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle,
} from "@/components/ui/dialog";
import {
    ArrowLeft, Send, Building2, FileText, ChevronDown,
    Loader2, Package, RotateCw, AlertCircle,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormActions from "@/components/shared/FormActions";
import LoadingState from "@/components/shared/LoadingState";
import SurfaceCard from "@/components/shared/SurfaceCard";

import apiClient from '@/services/apiClient';
import purchaseOrderDetailService from '@/services/purchaseOrderDetailService';
import purchaseOrderService from '@/services/purchaseOrderService';

const INFO_TILE = "rounded-lg border border-bo-border bg-bo-surface-subtle p-4";
const INFO_LABEL = "mb-1 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function SendQuotationRequest() {
    const navigate = useNavigate();
    const { id } = useParams(); // id của đơn mua hàng

    /* ── State ── */
    const [orderData, setOrderData] = useState(null);
    const [loadingOrder, setLoadingOrder] = useState(true);

    const [suppliers, setSuppliers] = useState([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);

    const [formData, setFormData] = useState({
        soDonMua: '',
        nhaCungCapId: '',
    });

    const [sending, setSending] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    /* ── Load order detail ── */
    const fetchOrder = useCallback(async () => {
        if (!id) return;
        setLoadingOrder(true);
        try {
            const result = await purchaseOrderDetailService.getById(id);
            if (result?.status === 200 && result?.data) {
                setOrderData(result.data);
                // Prefill soDonMua nếu đã có
                if (result.data.soDonMua) {
                    setFormData(prev => ({ ...prev, soDonMua: result.data.soDonMua }));
                }
                // Prefill nhaCungCapId nếu đã có
                if (result.data.nhaCungCap?.id) {
                    setFormData(prev => ({ ...prev, nhaCungCapId: result.data.nhaCungCap.id }));
                }
            }
        } catch (err) {
            console.error('Error fetching order:', err);
            toast.error('Không thể tải thông tin đơn hàng');
        } finally {
            setLoadingOrder(false);
        }
    }, [id]);

    /* ── Load suppliers ── */
    const fetchSuppliers = useCallback(async () => {
        setLoadingSuppliers(true);
        try {
            const suppliers = await purchaseOrderService.getUniqueSuppliers();
            setSuppliers(suppliers);
        } catch (err) {
            console.error('Error fetching suppliers:', err);
            toast.error('Không thể tải danh sách nhà cung cấp');
        } finally {
            setLoadingSuppliers(false);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch ngay khi mount / khi id đổi.
    useEffect(() => { queueMicrotask(() => fetchOrder()); }, [fetchOrder]);
    useEffect(() => { queueMicrotask(() => fetchSuppliers()); }, [fetchSuppliers]);

    /* ── Helpers ── */
    const selectedSupplier = suppliers.find(s => s.id === parseInt(formData.nhaCungCapId)) ?? null;

    const generateOrderNumber = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const r = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `PO${y}${m}${d}${r}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('vi-VN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
        });
    };

    /* ── Validate ── */
    const validate = () => {
        if (!formData.soDonMua.trim()) {
            toast.error('Vui lòng nhập số đơn mua');
            return false;
        }
        if (!formData.nhaCungCapId) {
            toast.error('Vui lòng chọn nhà cung cấp');
            return false;
        }
        return true;
    };

    /* ── Submit ── */
    const handleSubmit = () => {
        if (!validate()) return;
        setShowConfirmDialog(true);
    };

    const confirmSend = async () => {
        setSending(true);
        try {
            // Gọi API PUT /don-mua-hang/gui-yeu-cau-bao-gia
            // Backend sẽ tự cập nhật trạng thái sang 3 và gửi mail
            await apiClient.put('/api/v1/nghiep-vu/don-mua-hang/gui-yeu-cau-bao-gia', {
                id: parseInt(id),
                soDonMua: formData.soDonMua.trim(),
                nhaCungCapId: parseInt(formData.nhaCungCapId),
            });

            toast.success('Đã gửi yêu cầu báo giá thành công! Trạng thái đơn hàng đã được cập nhật.');
            setShowConfirmDialog(false);
            setTimeout(() => navigate('/quotation-requests'), 1500);
        } catch (err) {
            console.error('Error sending quotation request:', err);
            toast.error(err.response?.data?.message || 'Không thể gửi yêu cầu báo giá. Vui lòng thử lại.');
        } finally {
            setSending(false);
        }
    };

    /* ── Loading ── */
    if (loadingOrder) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState rows={5} label="Đang tải thông tin đơn hàng" />
                </div>
            </PageContainer>
        );
    }

    if (!orderData) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <EmptyState
                        icon={AlertCircle}
                        title="Không tìm thấy đơn hàng"
                        description="Đơn mua hàng có thể đã bị xóa hoặc không còn khả dụng."
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

    /* ══════════════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════════════ */
    return (
        <PageContainer className="space-y-5">

            {/* ── Navigation ── */}
            <PageHeader
                title="Gửi yêu cầu báo giá"
                description="Xác nhận số đơn và nhà cung cấp nhận email yêu cầu báo giá"
                actions={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(`/purchase-orders/${id}`)}
                        className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                    >
                        <ArrowLeft className="size-4" />
                        Quay lại chi tiết yêu cầu
                    </Button>
                }
            />

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">

                {/* ── Card: Thông tin gửi báo giá ── */}
                <SurfaceCard
                    title={<span className="flex items-center gap-2"><Send className="size-4 text-bo-primary" />Thông tin gửi báo giá</span>}
                >
                    {/* Số đơn mua */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-bo-foreground">
                            Số Đơn<span className="text-bo-danger">*</span>
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                value={formData.soDonMua}
                                onChange={(e) => setFormData(prev => ({ ...prev, soDonMua: e.target.value }))}
                                placeholder="Nhập hoặc tự sinh mã đơn..."
                                className="h-11 flex-1 rounded-md border-bo-border bg-white font-mono text-[15px] font-semibold text-bo-foreground shadow-none placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormData(prev => ({ ...prev, soDonMua: generateOrderNumber() }))}
                                className="size-11 shrink-0 rounded-md border-bo-border bg-white p-0 text-bo-foreground hover:bg-bo-surface-subtle"
                                title="Tự sinh mã"
                            >
                                <RotateCw className="size-4" />
                            </Button>
                        </div>
                        <p className="text-[12px] text-bo-muted">
                            Mã đơn sẽ được gửi kèm trong email đến nhà cung cấp
                        </p>
                    </div>

                    {/* Nhà cung cấp */}
                    <div className="mt-5 space-y-2">
                        <Label className="text-sm font-medium text-bo-foreground">
                            Nhà Cung Cấp <span className="text-bo-danger">*</span>
                        </Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={loadingSuppliers}
                                    className="h-11 w-full justify-between rounded-md border-bo-border bg-white px-4 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <Building2 className="size-4 shrink-0 text-slate-400" />
                                        <span className="truncate">
                                            {loadingSuppliers
                                                ? 'Đang tải...'
                                                : selectedSupplier
                                                    ? selectedSupplier.tenNhaCungCap
                                                    : 'Chọn nhà cung cấp...'}
                                        </span>
                                    </div>
                                    <ChevronDown className="size-4 shrink-0 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="z-50 max-h-[320px] w-[380px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                align="start"
                            >
                                {suppliers.length === 0 ? (
                                    <div className="p-4 text-center text-sm italic text-bo-muted">
                                        Không có nhà cung cấp nào
                                    </div>
                                ) : suppliers.map((s) => (
                                    <DropdownMenuItem
                                        key={s.id}
                                        onClick={() => setFormData(prev => ({ ...prev, nhaCungCapId: s.id }))}
                                        className="my-0.5 flex cursor-pointer flex-col items-start gap-1 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                    >
                                        <span className="font-semibold text-slate-900">{s.tenNhaCungCap}</span>
                                        <div className="flex w-full items-center justify-between text-xs text-bo-muted">
                                            <span>Mã: {s.maNhaCungCap}</span>
                                            {s.email && <span className="max-w-[180px] truncate text-slate-400">{s.email}</span>}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Thông tin nhà cung cấp đã chọn */}
                        {selectedSupplier && (
                            <div className="mt-2 space-y-2 rounded-lg border border-bo-primary/30 bg-bo-primary-soft p-4">
                                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-bo-primary">
                                    Thông tin nhà cung cấp
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-[13px]">
                                    <div>
                                        <span className="text-bo-muted">Người liên hệ:</span>
                                        <p className="font-semibold text-bo-foreground">{selectedSupplier.nguoiLienHe || '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-bo-muted">Điện thoại:</span>
                                        <p className="font-mono font-semibold text-bo-foreground">{selectedSupplier.soDienThoai || '—'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-bo-muted">Email:</span>
                                        <p className="font-semibold text-bo-primary">{selectedSupplier.email || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lưu ý */}
                    <div className="mt-5 rounded-lg border border-bo-warning/30 bg-bo-warning-soft p-4">
                        <p className="text-[13px] text-slate-700">
                            <strong>Lưu ý:</strong> Sau khi gửi, hệ thống sẽ tự động gửi email đến nhà cung cấp
                            và chuyển trạng thái đơn hàng sang <strong>"Đã gửi yêu cầu báo giá"</strong>.
                        </p>
                    </div>
                </SurfaceCard>

                {/* ── Card: Thông tin đơn hàng (readonly) ── */}
                <SurfaceCard
                    title={<span className="flex items-center gap-2"><FileText className="size-4 text-bo-primary" />Thông tin đơn hàng</span>}
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className={INFO_TILE}>
                            <p className={INFO_LABEL}>Kho nhập</p>
                            <p className="text-sm font-semibold text-bo-foreground">{orderData.khoNhap?.tenKho || '—'}</p>
                            <p className="font-mono text-[12px] text-bo-muted">{orderData.khoNhap?.maKho}</p>
                        </div>
                        <div className={INFO_TILE}>
                            <p className={INFO_LABEL}>Người tạo</p>
                            <p className="text-sm font-semibold text-bo-foreground">{orderData.nguoiTao?.hoTen || '—'}</p>
                            <p className="text-[12px] text-bo-muted">{orderData.nguoiTao?.email}</p>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className={INFO_TILE}>
                            <p className={INFO_LABEL}>Ngày đặt hàng</p>
                            <p className="text-sm font-semibold text-bo-foreground">{formatDate(orderData.ngayDatHang)}</p>
                        </div>
                        <div className={INFO_TILE}>
                            <p className={INFO_LABEL}>Ngày giao dự kiến</p>
                            <p className="text-sm font-semibold text-bo-foreground">{formatDate(orderData.ngayGiaoDuKien)}</p>
                        </div>
                    </div>

                    <div className={`mt-4 ${INFO_TILE}`}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm trong đơn</p>
                        <div className="max-h-[200px] space-y-2 overflow-y-auto">
                            {orderData.chiTietDonMuaHangs?.map((item, i) => (
                                <div key={i} className="flex items-center justify-between border-b border-bo-border py-1.5 text-[13px] last:border-0">
                                    <div className="flex items-center gap-2">
                                        {item.bienTheSanPham?.anhBienThe?.tepTin?.duongDan ? (
                                            <img
                                                src={item.bienTheSanPham.anhBienThe.tepTin.duongDan}
                                                alt=""
                                                className="size-8 shrink-0 rounded-md border border-bo-border object-cover"
                                            />
                                        ) : (
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-bo-border bg-bo-surface-subtle">
                                                <Package className="size-4 text-slate-400" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-semibold text-slate-700">{item.bienTheSanPham?.maSku}</p>
                                            <p className="text-[11px] text-bo-muted">{item.bienTheSanPham?.mauSac?.tenMau} - {item.bienTheSanPham?.size?.maSize}</p>
                                        </div>
                                    </div>
                                    <span className="font-semibold text-slate-600">x{item.soLuongDat}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-bo-border pt-3">
                            <span className="text-[12px] font-semibold uppercase tracking-wide text-bo-muted">Tổng SP:</span>
                            <span className="font-bold text-bo-foreground">{orderData.chiTietDonMuaHangs?.length || 0}</span>
                        </div>
                    </div>

                    {orderData.ghiChu && (
                        <div className={`mt-4 ${INFO_TILE}`}>
                            <p className={INFO_LABEL}>Ghi chú</p>
                            <p className="text-[13px] leading-relaxed text-slate-600">{orderData.ghiChu}</p>
                        </div>
                    )}
                </SurfaceCard>
            </div>

            {/* ── Action Buttons ── */}
            <FormActions className="rounded-lg border border-bo-border shadow-sm">
                <Button
                    variant="outline"
                    onClick={() => navigate(`/purchase-orders/${id}`)}
                    className="h-11 rounded-md border-bo-border bg-white px-6 font-medium text-bo-foreground hover:bg-bo-surface-subtle"
                >
                    Hủy bỏ
                </Button>
                <Button
                    onClick={handleSubmit}
                    className="h-11 gap-2 rounded-md bg-bo-primary px-6 font-semibold text-white hover:bg-bo-primary-hover"
                >
                    <Send className="size-4" />
                    Gửi yêu cầu báo giá
                </Button>
            </FormActions>

            {/* ── Confirm Dialog ── */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-bo-primary-soft px-5 py-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-bo-primary">
                            <Send className="size-5" />
                        </div>
                        <DialogTitle className="m-0 text-base font-semibold text-bo-foreground">
                            Xác nhận gửi yêu cầu báo giá
                        </DialogTitle>
                    </div>
                    <div className="p-5">
                        <DialogDescription className="mb-5 text-sm text-bo-muted">
                            Hệ thống sẽ gửi email yêu cầu báo giá đến nhà cung cấp và cập nhật trạng thái đơn hàng.
                        </DialogDescription>

                        <div className="mb-5 space-y-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-4 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-bo-muted">Số đơn:</span>
                                <span className="font-mono font-semibold text-bo-foreground">{formData.soDonMua}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-bo-muted">Nhà cung cấp:</span>
                                <span className="font-semibold text-bo-foreground">{selectedSupplier?.tenNhaCungCap}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-bo-muted">Email gửi đến:</span>
                                <span className="font-semibold text-bo-primary">{selectedSupplier?.email || '—'}</span>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowConfirmDialog(false)}
                                disabled={sending}
                                className="h-11 w-full rounded-md border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle sm:w-auto"
                            >
                                Hủy bỏ
                            </Button>
                            <Button
                                onClick={confirmSend}
                                disabled={sending}
                                className="h-11 w-full rounded-md bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover sm:w-auto"
                            >
                                {sending
                                    ? <><Loader2 className="mr-2 size-5 animate-spin" />Đang gửi...</>
                                    : <><Send className="mr-2 size-4" />Xác nhận gửi</>
                                }
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
