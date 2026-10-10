import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ChevronLeft, ChevronRight, ChevronDown, Search, Calendar,
    Eye, RefreshCw, Warehouse, Clock, CreditCard,
    ShoppingCart, DollarSign, PackagePlus, Plus,
} from 'lucide-react';
import apiClient from '@/services/apiClient';
import { getMineKhoList } from '@/services/khoService';

import PageContainer from '@/components/backoffice/PageContainer';
import PageHeader from '@/components/backoffice/PageHeader';
import TableShell from '@/components/shared/TableShell';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import FilterBar from '@/components/shared/FilterBar';
import SearchInput from '@/components/shared/SearchInput';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
};

const PO_STATUS = {
    3: { label: 'Đang vận chuyển', tone: 'warning', icon: Clock },
    5: { label: 'Đã thanh toán', tone: 'success', icon: CreditCard },
};

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

const formatCurrency = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function PurchaseOrderList() {
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    // Auth & Permission Data
    const [userRoles, setUserRoles] = useState([]);
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [warehouses, setWarehouses] = useState([]);
    const [isRestrictedWarehouse, setIsRestrictedWarehouse] = useState(false);

    // Pagination
    const [pagination, setPagination] = useState({ pageNumber: 0, pageSize: 10, totalElements: 0, totalPages: 0 });

    // Filters
    const [filters, setFilters] = useState({ soDonMua: '', trangThai: '', khoId: '' });
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    // Quyền thao tác
    const canCreateReceipt = userRoles.includes(ROLE.QUAN_TRI_VIEN) || userRoles.includes(ROLE.QUAN_LY_KHO) || userRoles.includes(ROLE.NHAN_VIEN_KHO);

    // ── Load Auth & Warehouses ──
    useEffect(() => {
        const loadInitialData = async () => {
            setLoadingInitial(true);
            try {
                const token = localStorage.getItem('access_token');
                if (!token) return;
                const payload = parseJwt(token);
                if (!payload?.id) return;

                // 1. Lấy vai trò user
                const resUser = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
                const roles = parseRoles(resUser.data?.data?.vaiTro);
                setUserRoles(roles);

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
        };

        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        queueMicrotask(() => loadInitialData());
    }, []);

    // ── Fetch list ──
    const fetchOrders = useCallback(async (page = 0, size = 10) => {
        setLoading(true);
        try {
            const filterArray = [];

            // Chỉ lấy đơn hàng có trạng thái 3 hoặc 5
            if (filters.trangThai && filters.trangThai !== 'all') {
                filterArray.push({ fieldName: 'trangThai', operation: 'EQUALS', value: parseInt(filters.trangThai), logicType: 'AND' });
            } else {
                filterArray.push({ fieldName: 'trangThai', operation: 'IN', value: [3, 5], logicType: 'AND' });
            }

            // Filter tìm kiếm theo số đơn mua
            if (filters.soDonMua) {
                filterArray.push({ fieldName: 'soDonMua', operation: 'LIKE', value: filters.soDonMua, logicType: 'AND' });
            }

            // Filter kho
            if (filters.khoId && filters.khoId !== 'all') {
                filterArray.push({ fieldName: 'khoNhap.id', operation: 'EQUALS', value: parseInt(filters.khoId), logicType: 'AND' });
            } else if (isRestrictedWarehouse) {
                const myIds = warehouses.map(w => w.id);
                if (myIds.length > 0) {
                    filterArray.push({ fieldName: 'khoNhap.id', operation: 'IN', value: myIds, logicType: 'AND' });
                } else {
                    filterArray.push({ fieldName: 'khoNhap.id', operation: 'EQUALS', value: -1, logicType: 'AND' });
                }
            }

            // Filter ngày tạo
            if (dateRange.from) filterArray.push({ fieldName: 'ngayTao', operation: 'GREATER_THAN_OR_EQUAL', value: dateRange.from, logicType: 'AND' });
            if (dateRange.to) filterArray.push({ fieldName: 'ngayTao', operation: 'LESS_THAN_OR_EQUAL', value: dateRange.to + 'T23:59:59', logicType: 'AND' });

            const res = await apiClient.post('/api/v1/don-mua-hang/filter', {
                filters: filterArray,
                sorts: [{ fieldName: 'ngayCapNhat', direction: 'DESC' }],
                page, size,
            });

            const data = res?.data?.data || res?.data || {};
            setOrders(data.content || []);
            setPagination({
                pageNumber: data.pageable?.pageNumber || 0,
                pageSize: data.pageable?.pageSize || 10,
                totalElements: data.totalElements || 0,
                totalPages: data.totalPages || 0,
            });
        } catch {
            toast.error('Không thể tải danh sách đơn mua hàng');
        } finally {
            setLoading(false);
        }
    }, [filters, dateRange, isRestrictedWarehouse, warehouses]);

    useEffect(() => {
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        if (!loadingInitial) queueMicrotask(() => fetchOrders(pagination.pageNumber, pagination.pageSize));
    }, [fetchOrders, loadingInitial, pagination.pageNumber, pagination.pageSize]);

    // ── Handlers ──
    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPagination(prev => ({ ...prev, pageNumber: 0 }));
    };

    const handleDateChange = (field, value) => {
        setDateRange(prev => ({ ...prev, [field]: value }));
        setPagination(prev => ({ ...prev, pageNumber: 0 }));
    };

    const handleSearch = () => {
        setPagination(prev => ({ ...prev, pageNumber: 0 }));
        fetchOrders(0, pagination.pageSize);
    };

    const clearFilters = () => {
        setFilters({ soDonMua: '', trangThai: '', khoId: '' });
        setDateRange({ from: '', to: '' });
        setPagination(prev => ({ ...prev, pageNumber: 0 }));
    };

    const handlePageChange = (p) => {
        if (p >= 0 && p < pagination.totalPages) {
            setPagination(prev => ({ ...prev, pageNumber: p }));
        }
    };

    const handlePageSizeChange = (s) => {
        setPagination(prev => ({ ...prev, pageNumber: 0, pageSize: s }));
    };

    // ── Stats ──
    const totalValue = orders.reduce((sum, order) => sum + (Number(order.tongTien) || 0), 0);
    const countStatus3 = orders.filter(o => o.trangThai === 3).length;
    const countStatus5 = orders.filter(o => o.trangThai === 5).length;

    const stats = [
        { label: 'Tổng Đơn mua hàng', value: pagination.totalElements, icon: <ShoppingCart className="size-4" />, iconClass: 'bg-bo-primary-soft text-bo-primary' },
        { label: 'Tổng giá trị (trang này)', value: formatCurrency(totalValue), icon: <DollarSign className="size-4" />, iconClass: 'bg-bo-success-soft text-bo-success' },
        { label: 'Chờ vận chuyển', value: countStatus3, icon: <Clock className="size-4" />, iconClass: 'bg-bo-warning-soft text-bo-warning' },
        { label: 'Đã thanh toán', value: countStatus5, icon: <CreditCard className="size-4" />, iconClass: 'bg-slate-100 text-slate-600' },
    ];

    const getSelectedWarehouseName = () => {
        if (!filters.khoId || filters.khoId === 'all') return 'Tất cả kho';
        return warehouses.find(w => w.id === parseInt(filters.khoId))?.tenKho || 'Đang tải...';
    };

    return (
        <PageContainer className="space-y-5">
            <PageHeader
              
                title="Đơn mua hàng"
                description="Theo dõi đơn mua hàng đang vận chuyển và đã thanh toán."
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => fetchOrders(pagination.pageNumber, pagination.pageSize)}
                            className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <RefreshCw className="size-4" /> Làm mới
                        </Button>
                        <Button
                            className="gap-1.5 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                            onClick={() => navigate('/purchase-orders/create')}
                        >
                            <Plus className="size-4" /> Tạo đơn mua hàng
                        </Button>
                    </>
                }
            />

            {/* ── Stats ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map(({ label, value, icon, iconClass }) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-bo-muted">{label}</p>
                            <p className="mt-1 truncate text-2xl font-bold tracking-tight text-bo-foreground">{value}</p>
                        </div>
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                            {icon}
                        </span>
                    </div>
                ))}
            </div>

            {/* ── Table ── */}
            <TableShell
                title="Danh sách đơn mua hàng"
                description="Nhấn vào dòng để xem chi tiết đơn mua hàng."
                toolbar={
                    <FilterBar
                        primary={
                            <SearchInput
                                value={filters.soDonMua}
                                onChange={e => handleFilterChange('soDonMua', e.target.value)}
                                onClear={() => handleFilterChange('soDonMua', '')}
                                onKeyPress={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Nhập mã đơn (VD: PO...)"
                                label="Tìm theo mã đơn mua hàng"
                            />
                        }
                        filters={
                            <>
                                {/* Kho nhập */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-9 justify-between gap-2 border-bo-border bg-white px-2.5 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                            disabled={loadingInitial || warehouses.length === 0}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Warehouse className="size-4 shrink-0 text-bo-muted" />
                                                <span className="truncate">{getSelectedWarehouseName()}</span>
                                            </div>
                                            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className="backoffice-user-menu z-50 max-h-[300px] w-[240px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                    >
                                        <DropdownMenuItem
                                            onClick={() => handleFilterChange('khoId', 'all')}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
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
                                                    <span className="text-sm font-medium text-slate-700">{w.tenKho}</span>
                                                    <span className="mt-0.5 font-mono text-[11px] text-bo-muted">{w.maKho}</span>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Trạng thái */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-9 min-w-[150px] justify-between gap-2 border-bo-border bg-white px-2.5 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                        >
                                            <span className="truncate">
                                                {filters.trangThai && filters.trangThai !== 'all' ? PO_STATUS[filters.trangThai]?.label : 'Tất cả'}
                                            </span>
                                            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                    >
                                        <DropdownMenuItem
                                            onClick={() => handleFilterChange('trangThai', 'all')}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            Tất cả (3 &amp; 5)
                                        </DropdownMenuItem>
                                        {Object.entries(PO_STATUS).map(([key, cfg]) => {
                                            const StatusIcon = cfg.icon;
                                            return (
                                                <DropdownMenuItem
                                                    key={key}
                                                    onClick={() => handleFilterChange('trangThai', key)}
                                                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <StatusIcon className="size-4 text-bo-muted" />
                                                        {cfg.label}
                                                    </div>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Date Range */}
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-bo-muted" />
                                        <input
                                            type="date"
                                            aria-label="Từ ngày"
                                            value={dateRange.from}
                                            onChange={e => handleDateChange('from', e.target.value)}
                                            className="h-9 rounded-md border border-bo-border bg-white pl-8 pr-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                                        />
                                    </div>
                                    <span className="text-xs text-bo-muted">→</span>
                                    <div className="relative">
                                        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-bo-muted" />
                                        <input
                                            type="date"
                                            aria-label="Đến ngày"
                                            value={dateRange.to}
                                            onChange={e => handleDateChange('to', e.target.value)}
                                            className="h-9 rounded-md border border-bo-border bg-white pl-8 pr-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                                        />
                                    </div>
                                </div>
                            </>
                        }
                        actions={
                            <>
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="h-9 border-bo-border bg-white text-sm font-medium text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Đặt lại
                                </Button>
                                <Button
                                    onClick={handleSearch}
                                    className="h-9 gap-1.5 bg-bo-primary text-sm font-semibold text-white hover:bg-bo-primary-hover"
                                >
                                    <Search className="size-4" /> Lọc dữ liệu
                                </Button>
                            </>
                        }
                    />
                }
                footer={
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Page size */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-bo-muted">Hiển thị</span>
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
                                <DropdownMenuContent
                                    align="start"
                                    className="backoffice-user-menu z-50 w-[110px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {[5, 10, 20, 50].map(s => (
                                        <DropdownMenuItem
                                            key={s}
                                            onClick={() => handlePageSizeChange(s)}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {s} dòng
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Page info */}
                        <p className="text-xs text-bo-muted">
                            Hiển thị{" "}
                            <span className="font-semibold text-bo-foreground">
                                {pagination.totalElements === 0 ? 0 : pagination.pageNumber * pagination.pageSize + 1}
                            </span>
                            {" – "}
                            <span className="font-semibold text-bo-foreground">
                                {Math.min((pagination.pageNumber + 1) * pagination.pageSize, pagination.totalElements)}
                            </span>
                            {" trong "}
                            <span className="font-semibold text-bo-primary">{pagination.totalElements}</span> kết quả
                        </p>

                        {/* Navigation */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.pageNumber - 1)}
                                disabled={pagination.pageNumber === 0}
                                className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                <ChevronLeft className="size-3.5" /> Trước
                            </Button>

                            <div className="hidden items-center gap-1 sm:flex">
                                {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {
                                    let p = idx;
                                    if (pagination.totalPages > 5) {
                                        if (pagination.pageNumber < 3) p = idx;
                                        else if (pagination.pageNumber > pagination.totalPages - 4) p = pagination.totalPages - 5 + idx;
                                        else p = pagination.pageNumber - 2 + idx;
                                    }
                                    return (
                                        <Button
                                            key={idx}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(p)}
                                            className={
                                                pagination.pageNumber === p
                                                    ? "h-8 border-bo-primary bg-bo-primary px-2.5 text-xs text-white hover:bg-bo-primary-hover"
                                                    : "h-8 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle"
                                            }
                                        >
                                            {p + 1}
                                        </Button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.pageNumber + 1)}
                                disabled={pagination.pageNumber >= pagination.totalPages - 1 || pagination.totalPages === 0}
                                className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                Sau <ChevronRight className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                }
            >
                <table className="w-full min-w-[960px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-10 w-14 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mã Đơn Mua</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Nhà cung cấp</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày tạo</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                            <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền</th>
                            <th className="h-10 w-32 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {loading || loadingInitial ? (
                            <tr>
                                <td colSpan={7}>
                                    <LoadingState label="Đang tải danh sách đơn mua hàng" />
                                </td>
                            </tr>
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={7}>
                                    <EmptyState
                                        icon={ShoppingCart}
                                        title="Không tìm thấy đơn mua hàng nào"
                                        description="Vui lòng thử thay đổi bộ lọc"
                                    />
                                </td>
                            </tr>
                        ) : orders.map((order, index) => {
                            const cfg = PO_STATUS[order.trangThai] || { label: 'Không rõ', tone: 'neutral' };
                            const isStatus3 = order.trangThai === 3;
                            const isStatus5 = order.trangThai === 5;

                            return (
                                <tr
                                    key={order.id}
                                    className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                    onClick={() => navigate(`/purchase-orders/${order.id}`)}
                                >
                                    <td className="px-3 py-3 text-center text-[13px] font-medium text-bo-muted">
                                        {pagination.pageNumber * pagination.pageSize + index + 1}
                                    </td>

                                    <td className="px-3 py-3">
                                        <span className="text-sm font-semibold tracking-wide text-bo-primary">{order.soDonMua}</span>
                                        {order.yeuCauMuaHang?.soYeuCauMuaHang && (
                                            <p className="mt-0.5 font-mono text-[11px] text-bo-muted">Từ: {order.yeuCauMuaHang.soYeuCauMuaHang}</p>
                                        )}
                                    </td>

                                    <td className="px-3 py-3">
                                        <p className="text-sm font-semibold text-bo-foreground">{order.nhaCungCap?.tenNhaCungCap || '—'}</p>
                                        <p className="mt-0.5 font-mono text-[11px] text-bo-muted">{order.nhaCungCap?.maNhaCungCap}</p>
                                    </td>

                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
                                            <Calendar className="size-3.5 text-bo-muted" /> {formatDate(order.ngayTao)}
                                        </div>
                                    </td>

                                    <td className="px-3 py-3">
                                        <StatusBadge label={cfg.label} tone={cfg.tone} />
                                    </td>

                                    <td className="px-3 py-3 text-right">
                                        <span className={`text-[15px] font-bold tracking-tight ${isStatus5 ? 'text-bo-success' : 'text-bo-foreground'}`}>
                                            {formatCurrency(order.tongTien)}
                                        </span>
                                    </td>

                                    <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                        <TooltipProvider>
                                            <div className="flex items-center justify-center gap-1">
                                                {/* Xem chi tiết */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 text-bo-muted hover:bg-bo-primary-soft hover:text-bo-primary"
                                                            onClick={() => navigate(`/purchase-orders/${order.id}`)}
                                                        >
                                                            <Eye className="size-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Xem chi tiết đơn</p></TooltipContent>
                                                </Tooltip>

                                                {/* Thanh toán (Chỉ trạng thái 3) */}
                                                {isStatus3 && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 text-bo-muted hover:bg-bo-success-soft hover:text-bo-success"
                                                                onClick={() => navigate(`/purchase-orders/${order.id}/payment`)}
                                                            >
                                                                <CreditCard className="size-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Thanh toán đơn hàng</p></TooltipContent>
                                                    </Tooltip>
                                                )}

                                                {/* Nhập kho (Chỉ trạng thái 3 hoặc 5, và có quyền) */}
                                                {canCreateReceipt && (isStatus3 || isStatus5) && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 text-bo-muted hover:bg-bo-warning-soft hover:text-bo-warning"
                                                                onClick={() => navigate(`/goods-receipts/create?poId=${order.id}`)}
                                                            >
                                                                <PackagePlus className="size-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Tạo phiếu nhập kho</p></TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </TooltipProvider>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </TableShell>
        </PageContainer>
    );
}
