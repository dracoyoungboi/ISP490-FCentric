import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    ChevronLeft, ChevronRight, ChevronDown, Calendar,
    Plus, RefreshCw, Warehouse, CheckCircle,
    XCircle, Clock, FileText, Loader2, AlertCircle, Package, SearchX,
} from 'lucide-react';

import PageContainer from '@/components/backoffice/PageContainer';
import AttentionBar from '@/components/shared/AttentionBar';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ListPageHeader from '@/components/shared/ListPageHeader';
import ListToolbar from '@/components/shared/ListToolbar';
import LoadingState from '@/components/shared/LoadingState';
import StatusBadge from '@/components/shared/StatusBadge';
import StatusTabs from '@/components/shared/StatusTabs';
import TableShell from '@/components/shared/TableShell';

import { YEU_CAU_NHAP_HANG_TABS, getYeuCauNhapHangStatus } from '@/constants/yeuCauNhapHang';
import useDemTheoTrangThai from '@/hooks/useDemTheoTrangThai';
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

// Tên + màu trạng thái lấy từ constants/yeuCauNhapHang (một tên cho danh sách, chi tiết, bản in); ở đây chỉ giữ icon.
const STATUS_ICON = {
    1: Clock,
    2: CheckCircle,
    3: FileText,
    4: XCircle,
    5: FileText,
};

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=, kho đang lọc trên ?kho=
const TAB_MAS = YEU_CAU_NHAP_HANG_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = 'tat-ca';
const TONE_TAB = { 'cho-duyet': 'warning' };

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function PurchaseRequestList() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const requestIdRef = useRef(0);

    // Auth & Permission Data
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [warehouses, setWarehouses] = useState([]);
    const [isRestrictedWarehouse, setIsRestrictedWarehouse] = useState(false);
    // Quản trị viên và Quản lý kho duyệt được yêu cầu (YeuCauMuaHangService.coQuyenDuyetKho)
    const [canApprove, setCanApprove] = useState(false);

    // Pagination
    const [pagination, setPagination] = useState({ pageNumber: 0, pageSize: 10, totalElements: 0, totalPages: 0 });

    // Filters: tab trạng thái + kho đọc từ URL (F5 / link từ Tổng quan mở đúng tab); ngày giữ trong state
    const tabParam = searchParams.get('trangThai');
    const tab = TAB_MAS.includes(tabParam) ? tabParam : TAB_MAC_DINH;
    const tabTrangThai = YEU_CAU_NHAP_HANG_TABS.find((t) => t.ma === tab)?.trangThai ?? null;
    const khoParam = searchParams.get('kho') ?? '';
    const khoId = warehouses.some((w) => String(w.id) === khoParam) ? khoParam : '';
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
            setCanApprove(roles.includes('quan_tri_vien') || roles.includes('quan_ly_kho'));

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

    // ── Điều kiện lọc dùng chung cho danh sách, số trên tab và dòng chú ý ──
    const buildFilterArray = useCallback(({ trangThai, kho, ngay }) => {
        const filterArray = [];

        // Filter trạng thái (tab "Đã chuyển báo giá" gồm 2 trạng thái 3 và 5)
        if (trangThai?.length === 1) {
            filterArray.push({ fieldName: 'trangThai', operation: 'EQUALS', value: trangThai[0], logicType: 'AND' });
        } else if (trangThai?.length > 1) {
            filterArray.push({ fieldName: 'trangThai', operation: 'IN', value: trangThai, logicType: 'AND' });
        }

        // Filter kho
        if (kho) {
            filterArray.push({ fieldName: 'khoNhap.id', operation: 'EQUALS', value: parseInt(kho), logicType: 'AND' });
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
        if (ngay.from) filterArray.push({ fieldName: 'ngayTao', operation: 'GREATER_THAN_OR_EQUAL', value: ngay.from, logicType: 'AND' });
        if (ngay.to) filterArray.push({ fieldName: 'ngayTao', operation: 'LESS_THAN_OR_EQUAL', value: ngay.to + 'T23:59:59', logicType: 'AND' });

        return filterArray;
    }, [isRestrictedWarehouse, warehouses]);

    const countRequests = async (filters) => {
        const res = await purchaseRequestService.filter({ filters, sorts: [], page: 0, size: 1 });
        const data = res?.data?.data || res?.data || {};
        return data.totalElements ?? 0;
    };

    // ── Fetch list ──
    const fetchRequests = useCallback(async (page = 0, size = 10) => {
        // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const res = await purchaseRequestService.filter({
                filters: buildFilterArray({ trangThai: tabTrangThai, kho: khoId, ngay: dateRange }),
                sorts: [{ fieldName: 'ngayTao', direction: 'DESC' }],
                page, size,
            });
            if (requestId !== requestIdRef.current) return;
            const data = res?.data?.data || res?.data || {};
            setRequests(data.content || []);
            setPagination({
                pageNumber: data.pageable?.pageNumber || 0,
                pageSize: data.pageable?.pageSize || 10,
                totalElements: data.totalElements || 0,
                totalPages: data.totalPages || 0,
            });
            setLoadError(false);
        } catch {
            if (requestId !== requestIdRef.current) return;
            // Không giữ dòng + tổng số của lần tải trước: tránh hiện số liệu cũ như thể khớp bộ lọc mới (R9)
            setLoadError(true);
            setRequests([]);
            setPagination(prev => ({ ...prev, totalElements: 0, totalPages: 0 }));
            toast.error('Không thể tải danh sách yêu cầu mua hàng');
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
        // tabTrangThai là mảng hằng trong YEU_CAU_NHAP_HANG_TABS, chỉ đổi khi đổi tab
    }, [buildFilterArray, tabTrangThai, khoId, dateRange]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect; vẫn fetch lại
    // ngay khi bộ lọc / trang thay đổi hoặc thông tin quyền tải xong.
    useEffect(() => {
        if (loadingInitial) return;
        queueMicrotask(() => fetchRequests(pagination.pageNumber, pagination.pageSize));
    }, [fetchRequests, loadingInitial, pagination.pageNumber, pagination.pageSize]);

    // ── Số trên tab: cùng kho + ngày đang lọc, chỉ thay trạng thái (R1) ──
    const phamViKho = `${isRestrictedWarehouse}|${warehouses.map((w) => w.id).join(',')}`;
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        (ma) => countRequests(buildFilterArray({
            trangThai: YEU_CAU_NHAP_HANG_TABS.find((t) => t.ma === ma)?.trangThai,
            kho: khoId,
            ngay: dateRange,
        })),
        `${phamViKho}|${khoId}|${dateRange.from}|${dateRange.to}`,
        { enabled: !loadingInitial }
    );

    // ── Dòng chú ý: yêu cầu chờ duyệt trong phạm vi kho của trang, bỏ qua các bộ lọc khác (R4) ──
    const choDuyet = useDemTheoTrangThai(
        ['cho-duyet'],
        () => countRequests(buildFilterArray({ trangThai: [1], kho: '', ngay: { from: '', to: '' } })),
        phamViKho,
        { enabled: !loadingInitial && canApprove }
    );

    const reloadCounts = () => {
        tabCounts.reload();
        choDuyet.reload();
    };

    // ── Approve / Reject ──
    const handleApprove = async (id, trangThai) => {
        setSubmitting(true);
        try {
            await purchaseRequestService.approve(id, trangThai);
            toast.success(trangThai === 2 ? 'Đã duyệt yêu cầu.' : 'Đã từ chối yêu cầu.');
            setApprovingId(null);
            fetchRequests(pagination.pageNumber, pagination.pageSize);
            reloadCounts();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Thao tác thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    // Ghi tab / kho lên URL (thay thế, không thêm lịch sử) và về trang đầu
    const updateUrl = (changes) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            Object.entries(changes).forEach(([key, value]) => {
                if (!value || value === TAB_MAC_DINH || value === 'all') next.delete(key);
                else next.set(key, String(value));
            });
            return next;
        }, { replace: true });
        setPagination(prev => ({ ...prev, pageNumber: 0 }));
    };

    const changeTab = (value) => updateUrl({ trangThai: value });

    const hasActiveFilters = Boolean(khoId || dateRange.from || dateRange.to);

    // "Xóa lọc": bỏ kho + ngày, giữ tab đang chọn
    const clearFilters = () => {
        setDateRange(prev => (prev.from || prev.to ? { from: '', to: '' } : prev));
        updateUrl({ kho: '' });
    };

    // Nút của dòng chú ý: mở tab Chờ duyệt, bỏ các bộ lọc khác để số dòng khớp số trên dòng chú ý
    const showPending = () => {
        setDateRange(prev => (prev.from || prev.to ? { from: '', to: '' } : prev));
        updateUrl({ trangThai: 'cho-duyet', kho: '' });
    };

    const handleRefresh = () => {
        fetchRequests(pagination.pageNumber, pagination.pageSize);
        reloadCounts();
    };

    const getStatusIcon = (status) => {
        const StatusIcon = STATUS_ICON[status] || AlertCircle;
        return <StatusIcon className="size-3.5" />;
    };

    const getSelectedWarehouseName = () => {
        if (!khoId) return 'Tất cả kho';
        return warehouses.find(w => String(w.id) === khoId)?.tenKho || 'Đang tải...';
    };

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = YEU_CAU_NHAP_HANG_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        tone: TONE_TAB[t.ma],
        count: loadError ? null : tabCounts.counts[t.ma],
    }));

    // Ghi chú phạm vi cho người chỉ xem kho mình phụ trách (R3)
    const scopeNote = !isRestrictedWarehouse || loadingInitial
        ? null
        : warehouses.length > 0
            ? `Kho bạn phụ trách: ${warehouses.map((w) => w.tenKho).join(', ')}`
            : 'Bạn chưa được phân công kho nào nên danh sách đang trống.';

    const pendingCount = canApprove && tab !== 'cho-duyet' ? choDuyet.counts['cho-duyet'] : null;
    const emptyTabLabel = YEU_CAU_NHAP_HANG_TABS.find((t) => t.ma === tab)?.label;

    return (
        <PageContainer className="space-y-4">
            <ListPageHeader
                scope={scopeNote}
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
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

            <AttentionBar
                count={pendingCount}
                actionLabel="Xem yêu cầu chờ duyệt"
                onAction={showPending}
            >
                <strong className="font-semibold">{pendingCount?.toLocaleString('vi-VN')} yêu cầu</strong> đang chờ duyệt.
            </AttentionBar>

            {/* ── Table ── */}
            <TableShell
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc yêu cầu nhập hàng theo trạng thái"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={clearFilters}
                    >
                        {/* Kho nhập */}
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    aria-label="Lọc theo kho nhập"
                                    className="h-9 w-full justify-between border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[200px]"
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
                                align="end"
                                className="backoffice-user-menu z-50 max-h-[400px] w-[260px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                            >
                                <DropdownMenuItem
                                    onClick={() => updateUrl({ kho: '' })}
                                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                >
                                    Tất cả kho
                                </DropdownMenuItem>
                                {warehouses.map(w => (
                                    <DropdownMenuItem
                                        key={w.id}
                                        onClick={() => updateUrl({ kho: w.id })}
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

                        {/* Từ ngày / Đến ngày: nhãn nằm trong ô để hàng công cụ gọn một dòng */}
                        {[
                            { key: 'from', label: 'Từ ngày' },
                            { key: 'to', label: 'Đến ngày' },
                        ].map(({ key, label }) => (
                            <label
                                key={key}
                                className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto"
                            >
                                <Calendar className="size-4 shrink-0 text-bo-muted" />
                                <span className="shrink-0 text-xs text-bo-muted">{label}</span>
                                <Input
                                    type="date"
                                    aria-label={label}
                                    className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0"
                                    value={dateRange[key]}
                                    onChange={e => { setDateRange(p => ({ ...p, [key]: e.target.value })); setPagination(p => ({ ...p, pageNumber: 0 })); }}
                                />
                            </label>
                        ))}
                    </ListToolbar>
                }
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
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải danh sách yêu cầu nhập hàng. Vui lòng thử lại."
                        onRetry={handleRefresh}
                    />
                ) : requests.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy yêu cầu nhập hàng phù hợp"
                            description="Thử đổi kho hoặc khoảng ngày."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={Package}
                            title={`Không có yêu cầu nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi yêu cầu nhập hàng."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeTab(TAB_MAC_DINH)}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Package}
                            title="Chưa có yêu cầu nhập hàng"
                            description="Tạo yêu cầu nhập hàng khi kho cần nhập thêm hàng."
                        />
                    )
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
                                const cfg = getYeuCauNhapHangStatus(req.trangThai);
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
