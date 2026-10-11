import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ChevronLeft, ChevronRight, ChevronDown, Search, Calendar,
    Filter, Plus, RefreshCw, Warehouse, CheckCircle,
    XCircle, Clock, FileText, Loader2, AlertCircle, Package,
} from 'lucide-react';

import PageContainer from '@/components/backoffice/PageContainer';
import PageHeader from '@/components/backoffice/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import FilterBar from '@/components/shared/FilterBar';
import LoadingState from '@/components/shared/LoadingState';
import StatusBadge from '@/components/shared/StatusBadge';
import TableShell from '@/components/shared/TableShell';

import purchaseRequestService from '@/services/purchaseRequestService';
import apiClient from '@/services/apiClient';
import { getMineKhoList } from '@/services/khoService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJwt(token) {
    try {
        const b64 = token.split('.')[1];
        return JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
}

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(' ') ? vaiTro.split(' ') : [vaiTro];
}

const statusConfig = {
    1: { label: 'Chờ duyệt', tone: 'warning', icon: Clock },
    2: { label: 'Đã duyệt', tone: 'success', icon: CheckCircle },
    3: { label: 'Đã chuyển thành báo giá', tone: 'info', icon: FileText },
    4: { label: 'Từ chối', tone: 'danger', icon: XCircle },
    5: { label: 'Đã chuyển thành báo giá', tone: 'info', icon: FileText },
};

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function PurchaseRequestList() {
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    // Auth & Permission Data
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [warehouses, setWarehouses] = useState([]);
    const [isRestrictedWarehouse, setIsRestrictedWarehouse] = useState(false);

    // Pagination
    const [pagination, setPagination] = useState({ pageNumber: 0, pageSize: 10, totalElements: 0, totalPages: 0 });

    // Filters
    const [filters, setFilters] = useState({ trangThai: '', khoId: '' });
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    // Action Dialogs
    const [approvingId, setApprovingId] = useState(null);  // { id, action: 'approve'|'reject' }
    const [submitting, setSubmitting] = useState(false);

    // ── Load Auth & Warehouses ──
    const loadInitialData = useCallback(async () => {
        setLoadingInitial(true);
        try {
            const token = localStorage.getItem('access_token');
            if (!token) return;
            const payload = parseJwt(token);
            if (!payload?.id) return;

            // 1. Lấy vai trò user
            const resUser = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
            const roles = parseRoles(resUser.data?.data?.vaiTro);

            // 2. Xác định giới hạn truy cập kho
            const isAdminOrBuyer = roles.includes('quan_tri_vien') || roles.includes('nhan_vien_mua_hang');
            const isKho = roles.includes('quan_ly_kho') || roles.includes('nhan_vien_kho');
            const restricted = !isAdminOrBuyer && isKho;
            setIsRestrictedWarehouse(restricted);

            // 3. Tải danh sách kho tương ứng
            let fetchedWarehouses = [];
            if (restricted) {
                fetchedWarehouses = await getMineKhoList();
            } else {
                const resKho = await apiClient.post('/api/v1/kho/filter', {
                    filters: [], sorts: [{ fieldName: 'tenKho', direction: 'ASC' }], page: 0, size: 100,
                });
                fetchedWarehouses = resKho.data?.data?.content || resKho.data?.content || [];
            }
            setWarehouses(fetchedWarehouses);

        } catch (error) {
            console.error('Lỗi khi tải thông tin phân quyền:', error);
        } finally {
            setLoadingInitial(false);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount.
    useEffect(() => { queueMicrotask(() => loadInitialData()); }, [loadInitialData]);

    // ── Fetch list ──
    const fetchRequests = useCallback(async (page = 0, size = 10) => {
        setLoading(true);
        try {
            const filterArray = [];

            // Filter trạng thái
            if (filters.trangThai && filters.trangThai !== 'all') {
                filterArray.push({ fieldName: 'trangThai', operation: 'EQUALS', value: parseInt(filters.trangThai), logicType: 'AND' });
            }

            // Filter kho
            if (filters.khoId && filters.khoId !== 'all') {
                filterArray.push({ fieldName: 'khoNhap.id', operation: 'EQUALS', value: parseInt(filters.khoId), logicType: 'AND' });
            } else if (isRestrictedWarehouse) {
                // Áp dụng giới hạn cứng nếu user không chọn kho và bị hạn chế quyền
                const myIds = warehouses.map(w => w.id);
                if (myIds.length > 0) {
                    filterArray.push({ fieldName: 'khoNhap.id', operation: 'IN', value: myIds, logicType: 'AND' });
                } else {
                    // Nếu user bị hạn chế mà chưa gán kho nào -> trả về rỗng
                    filterArray.push({ fieldName: 'khoNhap.id', operation: 'EQUALS', value: -1, logicType: 'AND' });
                }
            }

            // Filter ngày
            if (dateRange.from) filterArray.push({ fieldName: 'ngayTao', operation: 'GREATER_THAN_OR_EQUAL', value: dateRange.from, logicType: 'AND' });
            if (dateRange.to) filterArray.push({ fieldName: 'ngayTao', operation: 'LESS_THAN_OR_EQUAL', value: dateRange.to + 'T23:59:59', logicType: 'AND' });

            const res = await purchaseRequestService.filter({
                filters: filterArray,
                sorts: [{ fieldName: 'ngayTao', direction: 'DESC' }],
                page, size,
            });
            const data = res?.data?.data || res?.data || {};
            setRequests(data.content || []);
            setPagination({
                pageNumber: data.pageable?.pageNumber || 0,
                pageSize: data.pageable?.pageSize || 10,
                totalElements: data.totalElements || 0,
                totalPages: data.totalPages || 0,
            });
        } catch {
            toast.error('Không thể tải danh sách yêu cầu mua hàng');
        } finally {
            setLoading(false);
        }
    }, [filters, isRestrictedWarehouse, warehouses, dateRange]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect; vẫn fetch lại
    // ngay khi bộ lọc / trang thay đổi hoặc thông tin quyền tải xong.
    useEffect(() => {
        if (loadingInitial) return;
        queueMicrotask(() => fetchRequests(pagination.pageNumber, pagination.pageSize));
    }, [fetchRequests, loadingInitial, pagination.pageNumber, pagination.pageSize]);

    // ── Approve / Reject ──
    const handleApprove = async (id, trangThai) => {
        setSubmitting(true);
        try {
            await purchaseRequestService.approve(id, trangThai);
            toast.success(trangThai === 2 ? 'Đã duyệt yêu cầu.' : 'Đã từ chối yêu cầu.');
            setApprovingId(null);
            fetchRequests(pagination.pageNumber, pagination.pageSize);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Thao tác thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPagination(prev => ({ ...prev, pageNumber: 0 }));
    };

    const clearFilters = () => {
        setFilters({ trangThai: '', khoId: '' });
        setDateRange({ from: '', to: '' });
        setPagination(prev => ({ ...prev, pageNumber: 0 }));
    };

    // Stats
    const stats = {
        total: pagination.totalElements,
        pending: requests.filter(r => r.trangThai === 1).length,
        approved: requests.filter(r => r.trangThai === 2).length,
        sent: requests.filter(r => r.trangThai === 3 || r.trangThai === 5).length,
    };

    const getStatusIcon = (status) => {
        const StatusIcon = statusConfig[status]?.icon || AlertCircle;
        return <StatusIcon className="size-3.5" />;
    };

    const getSelectedWarehouseName = () => {
        if (!filters.khoId || filters.khoId === 'all') return 'Tất cả kho';
        return warehouses.find(w => w.id === parseInt(filters.khoId))?.tenKho || 'Đang tải...';
    };

    return (
        <PageContainer className="space-y-5">
            {/* ── Page header ── */}
            <PageHeader
                title="Yêu cầu nhập hàng"
                description="Theo dõi, duyệt và chuyển các yêu cầu nhập hàng thành đơn báo giá"
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => fetchRequests(pagination.pageNumber, pagination.pageSize)}
                            className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <RefreshCw className="size-4" />Làm mới
                        </Button>
                        <Button
                            className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                            onClick={() => navigate('/purchase-requests/create')}
                        >
                            <Plus className="size-4" />Tạo yêu cầu nhập hàng
                        </Button>
                    </>
                }
            />

            {/* ── Stats ── */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Tổng yêu cầu', value: stats.total, icon: <FileText className="size-5" />, iconClass: 'bg-bo-primary-soft text-bo-primary' },
                    { label: 'Chờ duyệt', value: stats.pending, icon: <Clock className="size-5" />, iconClass: 'bg-bo-warning-soft text-bo-warning' },
                    { label: 'Đã duyệt', value: stats.approved, icon: <CheckCircle className="size-5" />, iconClass: 'bg-bo-success-soft text-bo-success' },
                    { label: 'Đã chuyển báo giá', value: stats.sent, icon: <FileText className="size-5" />, iconClass: 'bg-bo-primary-soft text-bo-primary' },
                ].map(({ label, value, icon, iconClass }) => (
                    <div
                        key={label}
                        className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm"
                    >
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-bo-muted">{label}</p>
                            <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{value}</p>
                        </div>
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                            {icon}
                        </span>
                    </div>
                ))}
            </section>

            {/* ── Filters ── */}
            <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-bo-border px-4 py-3 sm:px-5">
                    <Filter className="size-4 text-bo-primary" />
                    <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">
                        Bộ lọc tìm kiếm
                    </h2>
                </div>
                <FilterBar
                    filters={
                        <>
                            {/* Kho */}
                            <div className="flex min-w-[200px] flex-col gap-1">
                                <span className="text-xs font-medium text-bo-muted">
                                    Kho nhập {warehouses.length > 0 && `(${warehouses.length})`}
                                </span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-9 w-full justify-between border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                            disabled={loadingInitial}
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <Warehouse className="size-4 shrink-0 text-slate-400" />
                                                <span className="truncate">{getSelectedWarehouseName()}</span>
                                            </span>
                                            <ChevronDown className="ml-2 size-4 shrink-0 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        className="backoffice-user-menu z-50 max-h-[400px] w-[260px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                    >
                                        <DropdownMenuItem
                                            onClick={() => handleFilterChange('khoId', 'all')}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            Tất cả kho
                                        </DropdownMenuItem>
                                        {warehouses.map(w => (
                                            <DropdownMenuItem
                                                key={w.id}
                                                onClick={() => handleFilterChange('khoId', w.id)}
                                                className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900">{w.tenKho}</span>
                                                    {w.maKho && <span className="text-xs text-bo-muted">Mã: {w.maKho}</span>}
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Trạng thái */}
                            <div className="flex min-w-[190px] flex-col gap-1">
                                <span className="text-xs font-medium text-bo-muted">Trạng thái</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-9 w-full justify-between border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                        >
                                            <span className="truncate">
                                                {filters.trangThai && filters.trangThai !== 'all'
                                                    ? statusConfig[filters.trangThai]?.label
                                                    : 'Tất cả trạng thái'}
                                            </span>
                                            <ChevronDown className="size-4 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                    >
                                        <DropdownMenuItem
                                            onClick={() => handleFilterChange('trangThai', 'all')}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            Tất cả trạng thái
                                        </DropdownMenuItem>
                                        {[1, 2, 4, 3].map(key => {
                                            const cfg = statusConfig[key];
                                            return (
                                                <DropdownMenuItem
                                                    key={key}
                                                    onClick={() => handleFilterChange('trangThai', key)}
                                                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                                >
                                                    <div className="flex items-center gap-2">{getStatusIcon(parseInt(key))}{cfg.label}</div>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Từ ngày */}
                            <div className="flex min-w-[170px] flex-col gap-1">
                                <span className="text-xs font-medium text-bo-muted">Từ ngày</span>
                                <div className="relative">
                                    <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" />
                                    <Input
                                        type="date"
                                        className="h-9 border-bo-border bg-white pl-9 text-sm text-bo-foreground shadow-none focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                                        value={dateRange.from}
                                        onChange={e => { setDateRange(p => ({ ...p, from: e.target.value })); setPagination(p => ({ ...p, pageNumber: 0 })); }}
                                    />
                                </div>
                            </div>

                            {/* Đến ngày */}
                            <div className="flex min-w-[170px] flex-col gap-1">
                                <span className="text-xs font-medium text-bo-muted">Đến ngày</span>
                                <div className="relative">
                                    <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" />
                                    <Input
                                        type="date"
                                        className="h-9 border-bo-border bg-white pl-9 text-sm text-bo-foreground shadow-none focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                                        value={dateRange.to}
                                        onChange={e => { setDateRange(p => ({ ...p, to: e.target.value })); setPagination(p => ({ ...p, pageNumber: 0 })); }}
                                    />
                                </div>
                            </div>
                        </>
                    }
                    actions={
                        <>
                            <Button
                                onClick={() => { setPagination(p => ({ ...p, pageNumber: 0 })); fetchRequests(0, pagination.pageSize); }}
                                className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                            >
                                <Search className="size-4" />Tìm kiếm
                            </Button>
                            <Button
                                variant="outline"
                                onClick={clearFilters}
                                className="h-9 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Đặt lại
                            </Button>
                        </>
                    }
                />
            </div>

            {/* ── Table ── */}
            <TableShell
                title="Danh sách yêu cầu nhập hàng"
                description="Nhấn vào một dòng để xem chi tiết yêu cầu"
                footer={
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Page size */}
                        <div className="flex items-center gap-2">
                            <span className="whitespace-nowrap text-xs text-bo-muted">Hiển thị</span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-8 w-[110px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        {pagination.pageSize} dòng
                                        <ChevronDown className="size-3.5 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="backoffice-user-menu z-50 w-[110px] rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                                    {[5, 10, 20, 50].map(size => (
                                        <DropdownMenuItem
                                            key={size}
                                            onClick={() => setPagination(p => ({ ...p, pageNumber: 0, pageSize: size }))}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {size} dòng
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Page info */}
                        <p className="text-xs text-bo-muted">
                            Hiển thị{' '}
                            <span className="font-semibold text-bo-foreground">
                                {pagination.totalElements === 0 ? 0 : pagination.pageNumber * pagination.pageSize + 1}
                            </span>
                            {' – '}
                            <span className="font-semibold text-bo-foreground">
                                {Math.min((pagination.pageNumber + 1) * pagination.pageSize, pagination.totalElements)}
                            </span>
                            {' trong '}
                            <span className="font-semibold text-bo-primary">{pagination.totalElements}</span> kết quả
                        </p>

                        {/* Navigation */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPagination(p => ({ ...p, pageNumber: p.pageNumber - 1 }))}
                                disabled={pagination.pageNumber === 0}
                                className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                <ChevronLeft className="size-3.5" />Trước
                            </Button>
                            <div className="hidden items-center gap-1 sm:flex">
                                {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {
                                    let pg = idx;
                                    if (pagination.totalPages > 5) {
                                        if (pagination.pageNumber < 3) pg = idx;
                                        else if (pagination.pageNumber > pagination.totalPages - 4) pg = pagination.totalPages - 5 + idx;
                                        else pg = pagination.pageNumber - 2 + idx;
                                    }
                                    return (
                                        <Button
                                            key={idx}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPagination(p => ({ ...p, pageNumber: pg }))}
                                            className={
                                                pagination.pageNumber === pg
                                                    ? 'h-8 border-bo-primary bg-bo-primary px-2.5 text-xs text-white hover:bg-bo-primary-hover'
                                                    : 'h-8 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle'
                                            }
                                        >
                                            {pg + 1}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPagination(p => ({ ...p, pageNumber: p.pageNumber + 1 }))}
                                disabled={pagination.pageNumber >= pagination.totalPages - 1 || pagination.totalPages === 0}
                                className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                Sau<ChevronRight className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                }
            >
                {loading || loadingInitial ? (
                    <LoadingState rows={5} label="Đang tải danh sách yêu cầu nhập hàng" />
                ) : requests.length === 0 ? (
                    <EmptyState
                        icon={Package}
                        title="Không tìm thấy yêu cầu nhập hàng"
                        description="Thử thay đổi bộ lọc hoặc tạo mới yêu cầu nhập hàng."
                    />
                ) : (
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kho nhập</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Người tạo</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày tạo</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày giao DK</th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {requests.map((req, index) => {
                                const cfg = statusConfig[req.trangThai] || statusConfig[1];
                                return (
                                    <tr
                                        key={req.id}
                                        className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                        onClick={() => navigate(`/purchase-requests/${req.id}`)}
                                    >
                                        <td className="px-3 py-3 text-center text-xs text-bo-muted">
                                            {pagination.pageNumber * pagination.pageSize + index + 1}
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="font-semibold text-bo-foreground">{req.khoNhap?.tenKho || '-'}</p>
                                            <p className="text-xs text-bo-muted">{req.khoNhap?.maKho}</p>
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="font-semibold text-bo-foreground">{req.nguoiTao?.hoTen || '-'}</p>
                                            <p className="text-xs text-bo-muted">{req.nguoiTao?.email}</p>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-600">
                                                <Calendar className="size-3.5 shrink-0 text-slate-400" />{formatDate(req.ngayTao)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-600">
                                                <Calendar className="size-3.5 shrink-0 text-slate-400" />{formatDate(req.ngayGiaoDuKien)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge
                                                tone={cfg.tone}
                                                dot={false}
                                                label={
                                                    <span className="flex items-center gap-1.5">
                                                        {getStatusIcon(req.trangThai)}{cfg.label}
                                                    </span>
                                                }
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>

            <AlertDialog open={!!approvingId} onOpenChange={(open) => !open && setApprovingId(null)}>
                <AlertDialogContent className="rounded-lg border border-bo-border bg-white text-bo-foreground shadow-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={`flex items-center gap-2 ${approvingId?.action === 'approve' ? 'text-bo-success' : 'text-bo-danger'}`}>
                            {approvingId?.action === 'approve' ? <CheckCircle className="size-5" /> : <XCircle className="size-5" />}
                            {approvingId?.action === 'approve' ? 'Xác nhận duyệt yêu cầu' : 'Xác nhận từ chối yêu cầu'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-bo-muted">
                            Bạn có chắc chắn muốn <strong>{approvingId?.action === 'approve' ? 'duyệt' : 'từ chối'}</strong> yêu cầu nhập hàng <strong>#{approvingId?.id}</strong>?
                            <br /><br />
                            {approvingId?.action === 'approve'
                                ? 'Sau khi duyệt, có thể gửi báo giá đến nhà cung cấp để tạo đơn báo giá tương ứng.'
                                : 'Hành động từ chối yêu cầu này không thể hoàn tác.'
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={submitting}
                            onClick={() => setApprovingId(null)}
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            Hủy
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleApprove(approvingId.id, approvingId?.action === 'approve' ? 2 : 4)}
                            disabled={submitting}
                            className={approvingId?.action === 'approve' ? 'bg-bo-success text-white hover:bg-bo-success/90' : 'bg-bo-danger text-white hover:bg-bo-danger/90'}
                        >
                            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            {approvingId?.action === 'approve' ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}
