import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/lib/thongBaoNhanh';
import {
    ArrowLeft, Send, Loader2, Building2,
    Mail, User, Package, AlertCircle,
    X, Sparkles, Check, ShoppingBag, Warehouse, Calendar, ListChecks, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import apiClient from '@/services/apiClient';
import purchaseRequestService from '@/services/purchaseRequestService';

import PageContainer from '@/components/backoffice/PageContainer';
import PageHeader from '@/components/backoffice/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import SearchInput from '@/components/shared/SearchInput';
import StatusBadge from '@/components/shared/StatusBadge';
import SurfaceCard from '@/components/shared/SurfaceCard';
import SupplierFormDialog from '@/components/supplier/SupplierFormDialog';
import { coTheGuiYeuCauBaoGia, laHoatDong } from '@/components/supplier/quyTacNhaCungCap';
import { ROLES, hasAnyRole } from '@/utils/roles';
import { getApiErrorMessage, getApiErrorStatus } from '@/utils/apiError';
import { formatDate as dinhDangNgay } from "@/utils/formatters";

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
// Định dạng chung toàn hệ thống: 05/10/2026 · 08:03; trống → "—"
const formatDate = (d) => dinhDangNgay(d);

const getInitials = (name = '') =>
    name.split(' ').filter(Boolean).slice(-2).map(w => w[0].toUpperCase()).join('');

const AVATAR_PALETTES = [
    'bg-bo-primary',
    'bg-violet-500',
    'bg-bo-success',
    'bg-bo-danger',
    'bg-bo-warning',
    'bg-slate-600',
];
const avatarColor = (name = '') => AVATAR_PALETTES[(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length];

/* ─── SupplierListItem ───────────────────────────────────────────────────────── */
function SupplierListItem({ supplier, isSelected, onToggle }) {
    // Chọn được khi đang hoạt động và có email (yêu cầu báo giá gửi qua email).
    const active = coTheGuiYeuCauBaoGia(supplier);
    const hoatDong = laHoatDong(supplier);
    return (
        <button
            type="button"
            onClick={() => active && onToggle(supplier.id)}
            disabled={!active}
            className={`
                flex w-full items-center gap-4 px-5 py-4 text-left transition-colors focus:outline-none
                ${isSelected
                    ? 'bg-bo-primary-soft'
                    : active
                        ? 'bg-white hover:bg-bo-surface-subtle'
                        : 'cursor-not-allowed bg-bo-surface-subtle opacity-60'
                }
            `}
        >
            {/* Checkbox */}
            <div className="flex shrink-0 items-center justify-center">
                <div className={`
                    flex size-5 items-center justify-center rounded border transition-colors
                    ${isSelected ? 'border-bo-primary bg-bo-primary' : 'border-slate-300 bg-white'}
                `}>
                    {isSelected && <Check className="size-3.5 text-white" strokeWidth={3} />}
                </div>
            </div>

            {/* Avatar */}
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white ${avatarColor(supplier.tenNhaCungCap)}`}>
                {getInitials(supplier.tenNhaCungCap)}
            </div>

            {/* Info Col 1: Name & Code */}
            <div className="min-w-0 flex-1 pr-4">
                <p className="truncate text-[15px] font-semibold text-bo-foreground">{supplier.tenNhaCungCap}</p>
                <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-[12px] font-medium uppercase tracking-wide text-bo-muted">{supplier.maNhaCungCap}</span>
                </div>
            </div>

            {/* Info Col 2: Contact */}
            <div className="hidden w-56 shrink-0 flex-col space-y-1.5 border-l border-bo-border pl-4 pr-4 sm:flex">
                <div className="flex items-center gap-2 text-[13px] text-slate-600">
                    <User className="size-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{supplier.nguoiLienHe || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-slate-600">
                    <Mail className="size-3.5 shrink-0 text-slate-400" />
                    <span className="truncate text-bo-primary">{supplier.email || '—'}</span>
                </div>
            </div>

            {/* Status */}
            <div className="hidden w-36 shrink-0 text-right md:block">
                <StatusBadge doiTuong="nguoi" label={!hoatDong ? 'Ngừng hoạt động' : active ? 'Hoạt động' : 'Chưa có email'} />
            </div>
        </button>
    );
}

/* ─── RequestInfoPanel ──────────────────────────────────────────────────────── */
function RequestInfoPanel({ request, loading, error, onRetry, onBack, id }) {
    if (loading) {
        return (
            <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <LoadingState rows={4} label="Đang tải thông tin yêu cầu" />
            </div>
        );
    }
    if (!request) {
        return (
            <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                {error && !error.notFound ? (
                    <ErrorState
                        title="Không thể tải thông tin yêu cầu"
                        description={error.message}
                        onRetry={onRetry}
                    />
                ) : (
                    <EmptyState
                        icon={AlertCircle}
                        title="Không tìm thấy yêu cầu nhập hàng"
                        description="Yêu cầu nhập hàng có thể đã bị xóa hoặc không còn khả dụng."
                        action={
                            <Button
                                type="button"
                                onClick={onBack}
                                className="bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                            >
                                Quay lại danh sách
                            </Button>
                        }
                    />
                )}
            </div>
        );
    }

    return (
        <SurfaceCard
            title={<span>Thông tin yêu cầu <span className="text-bo-primary">#{id}</span></span>}
            description="Xác nhận thông tin trước khi gửi báo giá đến nhà cung cấp."
        >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Meta Info (Left) */}
                <div className="space-y-4 lg:col-span-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted"><Warehouse className="size-3.5" /> Kho nhập</p>
                            <p className="text-sm font-semibold text-bo-foreground">{request.khoNhap?.tenKho || '—'}</p>
                            <p className="font-mono text-[12px] text-bo-muted">{request.khoNhap?.maKho}</p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted"><Calendar className="size-3.5" /> Ngày giao dự kiến</p>
                            <p className="text-sm font-semibold text-bo-foreground">{formatDate(request.ngayGiaoDuKien)}</p>
                        </div>
                    </div>

                    <div className="space-y-1.5 border-t border-bo-border pt-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted"><User className="size-3.5" /> Người tạo</p>
                        <p className="text-sm font-semibold text-bo-foreground">{request.nguoiTao?.hoTen || '—'}</p>
                    </div>

                    {request.ghiChu && (
                        <div className="mt-2 rounded-lg border border-bo-warning/30 bg-bo-warning-soft p-4">
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-warning">Ghi chú từ kho</p>
                            <p className="text-[13px] leading-relaxed text-slate-700">{request.ghiChu}</p>
                        </div>
                    )}
                </div>

                {/* Product List (Right) */}
                <div className="lg:col-span-7">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                            <ShoppingBag className="size-3.5" /> Sản phẩm yêu cầu
                        </p>
                        <span className="rounded-md border border-bo-primary/30 bg-bo-primary-soft px-2 py-0.5 text-[12px] font-semibold text-bo-primary">
                            {request.chiTietYeuCauMuaHangs?.length || 0} biến thể
                        </span>
                    </div>
                    <div className="max-h-[220px] space-y-2.5 overflow-y-auto pr-2">
                        {(request.chiTietYeuCauMuaHangs || []).map((item, i) => {
                            const img = item.bienTheSanPham?.anhBienThe?.tepTin?.duongDan;
                            return (
                                <div key={i} className="flex items-center gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle px-3 py-2.5 transition-colors hover:bg-white">
                                    {img ? (
                                        <div className="size-10 shrink-0 overflow-hidden rounded-md border border-bo-border">
                                            <img src={img} alt="" className="h-full w-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-bo-border bg-bo-surface-subtle">
                                            <Package className="size-5 text-slate-300" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-semibold text-bo-foreground" title={item.bienTheSanPham?.tenSanPham}>
                                            {item.bienTheSanPham?.tenSanPham || item.bienTheSanPham?.tenBienThe || item.bienTheSanPham?.maSku}
                                        </p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-[10px] text-bo-muted">{item.bienTheSanPham?.maSku}</span>
                                            {item.bienTheSanPham?.mauSac?.tenMau && (
                                                <span className="flex items-center gap-1 text-[10px] text-bo-muted">
                                                    <span className="size-1.5 rounded-full" style={{ backgroundColor: item.bienTheSanPham.mauSac.maMauHex }}></span>
                                                    {item.bienTheSanPham.mauSac.tenMau}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="shrink-0 rounded-md bg-bo-primary-soft px-2.5 py-1 text-[13px] font-semibold text-bo-primary">
                                        SL: {item.soLuongDat}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </SurfaceCard>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════════ */
export default function SendQuotationRequestPage() {
    const navigate = useNavigate();
    const { id } = useParams();

    // State
    const [suppliers, setSuppliers] = useState([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [suppliersError, setSuppliersError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [request, setRequest] = useState(null);
    const [loadingRequest, setLoadingRequest] = useState(true);
    // null | { notFound: true } | { notFound: false, message }
    const [requestError, setRequestError] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    // Thêm nhanh nhà cung cấp ngay tại đây (không phải rời màn sang trang Nhà cung cấp).
    const [addSupplierOpen, setAddSupplierOpen] = useState(false);
    const coTheThemNhaCungCap = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG]);

    /* ── Load Data: yêu cầu và nhà cung cấp tải riêng, lỗi bên nào báo bên đó ── */
    const loadRequest = useCallback(async () => {
        if (!id) return;
        setLoadingRequest(true);
        setRequestError(null);
        try {
            const resReq = await apiClient.get(`/api/v1/yeu-cau-mua-hang/get-by-id/${id}`);
            const data = resReq.data?.data || null;
            setRequest(data);
            if (!data) setRequestError({ notFound: true });
        } catch (error) {
            setRequest(null);
            // Máy chủ trả 400 "Không tìm thấy yêu cầu mua hàng id: …" khi mã không tồn tại
            const status = getApiErrorStatus(error);
            setRequestError(status === 404 || status === 400
                ? { notFound: true }
                : { notFound: false, message: getApiErrorMessage(error, 'Không thể tải thông tin yêu cầu nhập hàng') });
        } finally {
            setLoadingRequest(false);
        }
    }, [id]);

    const loadSuppliers = useCallback(async () => {
        setLoadingSuppliers(true);
        setSuppliersError(null);
        try {
            const resSup = await apiClient.get('/api/supplier');
            setSuppliers(resSup.data?.data || []);
        } catch (error) {
            setSuppliers([]);
            setSuppliersError(getApiErrorMessage(error, 'Không thể tải danh sách nhà cung cấp'));
        } finally {
            setLoadingSuppliers(false);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch ngay khi mount / khi id đổi.
    useEffect(() => { queueMicrotask(() => loadRequest()); }, [loadRequest]);
    useEffect(() => { queueMicrotask(() => loadSuppliers()); }, [loadSuppliers]);

    /* ── Derived State ── */
    const filteredSuppliers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return suppliers;
        return suppliers.filter(s =>
            s.tenNhaCungCap?.toLowerCase().includes(term) ||
            s.maNhaCungCap?.toLowerCase().includes(term) ||
            s.email?.toLowerCase().includes(term) ||
            s.nguoiLienHe?.toLowerCase().includes(term)
        );
    }, [suppliers, searchTerm]);

    const activeSuppliers = useMemo(() => suppliers.filter(coTheGuiYeuCauBaoGia), [suppliers]);
    const selectedSuppliersList = useMemo(() => suppliers.filter(s => selectedIds.has(s.id)), [suppliers, selectedIds]);
    const selectedCount = selectedIds.size;

    /* ── Handlers ── */
    const handleSupplierCreated = (created) => {
        setSuppliers(prev => [created, ...prev.filter(s => s.id !== created.id)]);
        if (coTheGuiYeuCauBaoGia(created)) {
            setSelectedIds(prev => new Set(prev).add(created.id));
        }
        // Đang lọc mà nhà cung cấp mới không khớp từ khóa thì xóa lọc để thấy dòng vừa thêm.
        setSearchTerm('');
        toast.success(`Đã thêm nhà cung cấp "${created.tenNhaCungCap}" và chọn vào danh sách gửi.`);
    };

    const toggleSupplier = (supplierId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(supplierId) ? next.delete(supplierId) : next.add(supplierId);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(activeSuppliers.filter(s => {
            const term = searchTerm.trim().toLowerCase();
            if (!term) return true;
            return s.tenNhaCungCap?.toLowerCase().includes(term) || s.maNhaCungCap?.toLowerCase().includes(term);
        }).map(s => s.id)));
    };

    const handleSend = async () => {
        setSubmitting(true);
        try {
            await purchaseRequestService.sendQuotationRequest({
                yeuCauMuaHangId: parseInt(id),
                nhaCungCapIds: Array.from(selectedIds),
                ghiChu: '',
            });
            toast.success(`Đã gửi yêu cầu báo giá đến ${selectedCount} nhà cung cấp.`);
            setShowConfirm(false);
            setTimeout(() => navigate('/purchase-requests'), 1200);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gửi yêu cầu thất bại. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <PageContainer className="space-y-5 pb-24">

            {/* ── Header ── */}
            <PageHeader
                title="Gửi yêu cầu báo giá"
                description="Chọn các nhà cung cấp phù hợp để gửi yêu cầu báo giá cho yêu cầu nhập hàng này"
                actions={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/purchase-requests')}
                        className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                    >
                        <ArrowLeft className="size-4" /> Quay lại
                    </Button>
                }
            />

            {/* ── Main Layout: 2 Columns ── */}
            <div className="flex flex-col items-start gap-5 xl:flex-row">

                {/* ════ LEFT COLUMN (Main Content) ════ */}
                <div className="w-full min-w-0 flex-1 space-y-5">
                    {/* 1. Request Info */}
                    <RequestInfoPanel
                        request={request}
                        loading={loadingRequest}
                        error={requestError}
                        onRetry={() => loadRequest()}
                        onBack={() => navigate('/purchase-requests')}
                        id={id}
                    />

                    {/* 2. Supplier Selection */}
                    <SurfaceCard
                        title={
                            <span className="flex items-center gap-2">
                                <ListChecks className="size-4 text-bo-primary" />Chọn nhà cung cấp
                            </span>
                        }
                        action={
                            <div className="flex items-center gap-3">
                                <div className="w-full sm:w-56">
                                    <SearchInput
                                        placeholder="Tìm tên, mã, email..."
                                        label="Tìm nhà cung cấp"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onClear={() => setSearchTerm('')}
                                        className="sm:max-w-none"
                                    />
                                </div>
                                <Button variant="outline" onClick={selectAll} className="hidden h-9 shrink-0 border-bo-border bg-white text-[13px] font-semibold text-bo-foreground hover:bg-bo-surface-subtle sm:flex">
                                    Chọn tất cả
                                </Button>
                                {coTheThemNhaCungCap ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => setAddSupplierOpen(true)}
                                        aria-label="Thêm nhà cung cấp"
                                        title="Thêm nhà cung cấp mới"
                                        className="h-9 shrink-0 gap-1.5 border-bo-border bg-white text-[13px] font-semibold text-bo-primary hover:bg-bo-primary-soft hover:text-bo-primary"
                                    >
                                        <Plus className="size-4" />
                                        Thêm mới
                                    </Button>
                                ) : null}
                            </div>
                        }
                    >
                        {loadingSuppliers ? (
                            <LoadingState rows={4} label="Đang tải danh sách nhà cung cấp" />
                        ) : suppliersError ? (
                            <ErrorState
                                title="Không thể tải danh sách nhà cung cấp"
                                description={suppliersError}
                                onRetry={() => loadSuppliers()}
                            />
                        ) : filteredSuppliers.length === 0 ? (
                            <EmptyState
                                icon={Building2}
                                title="Không tìm thấy nhà cung cấp phù hợp"
                                description="Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm."
                            />
                        ) : (
                            <div className="max-h-[500px] divide-y divide-bo-border overflow-y-auto overflow-hidden rounded-lg border border-bo-border">
                                {filteredSuppliers.map(supplier => (
                                    <SupplierListItem
                                        key={supplier.id}
                                        supplier={supplier}
                                        isSelected={selectedIds.has(supplier.id)}
                                        onToggle={toggleSupplier}
                                    />
                                ))}
                            </div>
                        )}
                        <p className="mt-3 text-[12px] font-medium text-bo-muted">
                            Hiển thị {filteredSuppliers.length} đối tác. Nhấn vào từng dòng để chọn/bỏ chọn.
                        </p>
                    </SurfaceCard>
                </div>

                {/* ════ RIGHT COLUMN (Sticky Cart) ════ */}
                <div className="sticky top-6 w-full shrink-0 xl:w-[380px]">
                    <div className="flex max-h-[calc(100vh-100px)] flex-col rounded-lg border border-bo-border bg-white shadow-sm">
                        <div className="flex shrink-0 items-center justify-between border-b border-bo-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="size-5 text-bo-primary" />
                                <p className="text-base font-semibold text-bo-foreground">Danh sách sẽ gửi</p>
                            </div>
                            <span className="rounded-md bg-bo-primary-soft px-3 py-1 text-[13px] font-semibold text-bo-primary">
                                {selectedCount} NCC
                            </span>
                        </div>

                        <div className="min-h-[250px] flex-1 overflow-y-auto p-4">
                            {selectedCount === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-bo-muted">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-bo-surface-subtle">
                                        <Send className="size-6 opacity-30" />
                                    </div>
                                    <p className="px-4 text-center text-[13px] leading-relaxed">Bạn chưa chọn đối tác nào.<br />Tích chọn ở danh sách bên trái để thêm vào đây.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="mb-3 flex items-center justify-between px-1">
                                        <p className="text-[12px] font-semibold uppercase tracking-wide text-bo-muted">Đã chọn</p>
                                        <button onClick={() => setSelectedIds(new Set())} className="text-[12px] font-semibold text-bo-danger transition-colors hover:text-bo-danger/80">Bỏ chọn tất cả</button>
                                    </div>
                                    {selectedSuppliersList.map(s => (
                                        <div key={s.id} className="flex items-center gap-3 rounded-lg border border-bo-border bg-white px-3 py-3">
                                            <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${avatarColor(s.tenNhaCungCap)}`}>
                                                {getInitials(s.tenNhaCungCap)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[13px] font-semibold text-bo-foreground">{s.tenNhaCungCap}</p>
                                                <p className="truncate text-[11px] text-bo-muted">{s.email || 'Không có email'}</p>
                                            </div>
                                            <button type="button" onClick={() => toggleSupplier(s.id)} className="group flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-bo-danger-soft hover:text-bo-danger">
                                                <X className="size-3.5 group-hover:text-bo-danger" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-bo-border bg-white p-4">
                            <Button
                                onClick={() => setShowConfirm(true)}
                                disabled={selectedCount === 0 || loadingRequest || !request}
                                className="h-12 w-full gap-2 rounded-md bg-bo-primary text-[15px] font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                <Send className="size-4" /> Gửi báo giá {selectedCount > 0 ? `(${selectedCount})` : ''}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Confirm Dialog ── */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-4 border-b border-bo-border bg-bo-primary-soft p-5">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white text-bo-primary">
                            <Send className="size-6" />
                        </div>
                        <div>
                            <DialogTitle className="m-0 text-base font-semibold text-bo-foreground">Xác nhận gửi báo giá</DialogTitle>
                            <DialogDescription className="mt-1 text-[13px] text-bo-muted">Hệ thống sẽ tự động tạo đơn và gửi email</DialogDescription>
                        </div>
                    </div>

                    <div className="space-y-5 p-5">
                        <div className="space-y-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-4 text-sm">
                            <div className="flex items-center justify-between"><span className="font-medium text-bo-muted">Yêu cầu nhập hàng:</span><span className="text-[15px] font-semibold text-bo-foreground">#{id}</span></div>
                            <div className="flex items-center justify-between"><span className="font-medium text-bo-muted">Kho nhập:</span><span className="font-semibold text-bo-foreground">{request?.khoNhap?.tenKho || '—'}</span></div>
                            <div className="h-px bg-bo-border" />
                            <div className="flex items-center justify-between"><span className="font-medium text-bo-muted">Số đối tác nhận:</span><span className="rounded-md bg-bo-primary-soft px-2 py-0.5 text-[18px] font-bold text-bo-primary">{selectedCount}</span></div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-bo-border">
                            <div className="border-b border-bo-border bg-bo-surface-subtle px-3.5 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Gửi đến ({selectedCount})</p></div>
                            <div className="max-h-[160px] divide-y divide-bo-border overflow-y-auto">
                                {selectedSuppliersList.map(s => (
                                    <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
                                        <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor(s.tenNhaCungCap)}`}>{getInitials(s.tenNhaCungCap)}</div>
                                        <p className="flex-1 truncate text-[13px] font-semibold text-bo-foreground">{s.tenNhaCungCap}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 px-5 pb-5">
                        <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={submitting} className="h-12 flex-1 rounded-md border-bo-border bg-white font-semibold text-bo-foreground hover:bg-bo-surface-subtle">Hủy bỏ</Button>
                        <Button onClick={handleSend} disabled={submitting} className="h-12 flex-1 gap-2 rounded-md bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover">
                            {submitting ? <><Loader2 className="size-5 animate-spin" />Đang gửi...</> : <><Send className="size-4" />Tiến hành gửi</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {coTheThemNhaCungCap ? (
                <SupplierFormDialog
                    open={addSupplierOpen}
                    onOpenChange={setAddSupplierOpen}
                    onSaved={handleSupplierCreated}
                />
            ) : null}
        </PageContainer>
    );
}
