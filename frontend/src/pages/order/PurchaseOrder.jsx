import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/lib/thongBaoNhanh';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ChevronDown, Calendar,
    Eye, Warehouse,
    ShoppingCart, PackagePlus, Plus, SearchX,
} from 'lucide-react';
import apiClient from '@/services/apiClient';
import { getMineKhoList } from '@/services/khoService';

import PageContainer from '@/components/backoffice/PageContainer';
import TableShell from '@/components/shared/TableShell';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ListPageHeader from '@/components/shared/ListPageHeader';
import ListToolbar from '@/components/shared/ListToolbar';
import LoadingState from '@/components/shared/LoadingState';
import { RowActionButton, RowActions } from '@/components/shared/RowActions';
import SearchInput from '@/components/shared/SearchInput';
import StatusTabs from '@/components/shared/StatusTabs';
import TablePagination from '@/components/shared/TablePagination';
import { SO_DONG_MAC_DINH } from '@/constants/phanTrang';
import { formatCurrency, formatDate } from '@/utils/formatters';

import { DON_MUA_HANG_TABS, DON_MUA_HANG_TAB_CU, getDonMuaHangStatus } from '@/constants/donMuaHang';
import useDemTheoTrangThai from '@/hooks/useDemTheoTrangThai';
import useTabTrenUrl from '@/hooks/useTabTrenUrl';
import useTaiLaiDanhSach from '@/hooks/useTaiLaiDanhSach';
import { trangCuoiNeuVuot } from '@/lib/tinhTaiLai';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
};

// Tên + màu trạng thái lấy từ constants/donMuaHang (một tên cho danh sách, chi tiết, bản in).
// Tab trạng thái (bố cục A+G) — mã tab trên URL ?trangThai=, kho đang lọc trên ?kho=
const TAB_MAS = DON_MUA_HANG_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = 'tat-ca';
const SEARCH_DEBOUNCE_MS = 350;
const API_FILTER = '/api/v1/don-mua-hang/filter';

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

async function countOrders(filters) {
    const res = await apiClient.post(API_FILTER, { filters, sorts: [], page: 0, size: 1 });
    const data = res?.data?.data || res?.data || {};
    return data.totalElements ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function PurchaseOrderList() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
    const requestIdRef = useRef(0);

    // Auth & Permission Data
    const [userRoles, setUserRoles] = useState([]);
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [warehouses, setWarehouses] = useState([]);
    const [isRestrictedWarehouse, setIsRestrictedWarehouse] = useState(false);

    // Pagination
    const [pagination, setPagination] = useState({ pageNumber: 0, pageSize: SO_DONG_MAC_DINH, totalElements: 0, totalPages: 0 });

    // Filters: tab trạng thái + kho đọc từ URL (F5 / quay lại từ chi tiết vẫn đúng tab); mã đơn + ngày giữ trong state.
    // Ô tìm kiếm: searchText là chữ đang gõ, keyword là từ khóa đang lọc (áp dụng khi ngừng gõ hoặc nhấn Enter).
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    // Đường dẫn cũ ?trangThai=da-thanh-toan (trạng thái 5 nay là "Đã nhận đủ"): chuyển sang mã tab mới
    const giaTriTab = searchParams.get('trangThai');
    const maTabCu = giaTriTab && Object.hasOwn(DON_MUA_HANG_TAB_CU, giaTriTab) ? DON_MUA_HANG_TAB_CU[giaTriTab] : null;
    useEffect(() => {
        if (maTabCu) setTab(maTabCu);
    }, [maTabCu, setTab]);
    const tabTrangThai = DON_MUA_HANG_TABS.find((t) => t.ma === tab)?.trangThai;
    const khoParam = searchParams.get('kho') ?? '';
    const khoId = warehouses.some((w) => String(w.id) === khoParam) ? khoParam : '';
    const [searchText, setSearchText] = useState('');
    const [keyword, setKeyword] = useState('');
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

    // ── Điều kiện lọc dùng chung cho danh sách và số trên tab (R2) ──
    const buildFilterArray = useCallback(({ trangThai, tuKhoa, kho, ngay }) => {
        const filterArray = [];

        // Chỉ lấy đơn hàng có trạng thái 3 hoặc 5 (tab Tất cả = cả hai)
        if (trangThai.length === 1) {
            filterArray.push({ fieldName: 'trangThai', operation: 'EQUALS', value: trangThai[0], logicType: 'AND' });
        } else {
            filterArray.push({ fieldName: 'trangThai', operation: 'IN', value: trangThai, logicType: 'AND' });
        }

        // Filter tìm kiếm theo số đơn mua
        if (tuKhoa) {
            filterArray.push({ fieldName: 'soDonMua', operation: 'LIKE', value: tuKhoa, logicType: 'AND' });
        }

        // Filter kho
        if (kho) {
            filterArray.push({ fieldName: 'khoNhap.id', operation: 'EQUALS', value: parseInt(kho), logicType: 'AND' });
        } else if (isRestrictedWarehouse) {
            // Quản lý kho / nhân viên kho chỉ xem đơn nhập về kho mình phụ trách
            const myIds = warehouses.map(w => w.id);
            if (myIds.length > 0) {
                filterArray.push({ fieldName: 'khoNhap.id', operation: 'IN', value: myIds, logicType: 'AND' });
            } else {
                // Chưa được phân công kho nào -> trả về rỗng
                filterArray.push({ fieldName: 'khoNhap.id', operation: 'EQUALS', value: -1, logicType: 'AND' });
            }
        }

        // Filter ngày tạo
        if (ngay.from) filterArray.push({ fieldName: 'ngayTao', operation: 'GREATER_THAN_OR_EQUAL', value: ngay.from, logicType: 'AND' });
        if (ngay.to) filterArray.push({ fieldName: 'ngayTao', operation: 'LESS_THAN_OR_EQUAL', value: ngay.to + 'T23:59:59', logicType: 'AND' });

        return filterArray;
    }, [isRestrictedWarehouse, warehouses]);

    // ── Fetch list ──
    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchOrders = useCallback(async (page = 0, size = SO_DONG_MAC_DINH, { silent = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const res = await apiClient.post(API_FILTER, {
                filters: buildFilterArray({ trangThai: tabTrangThai, tuKhoa: keyword, kho: khoId, ngay: dateRange }),
                sorts: [{ fieldName: 'ngayCapNhat', direction: 'DESC' }],
                page, size,
            });
            if (requestId !== requestIdRef.current) return;

            const data = res?.data?.data || res?.data || {};
            // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
            const trangCuoi = trangCuoiNeuVuot({ trang: page, kichThuoc: size, soDong: data.content?.length ?? 0, tong: data.totalElements });
            if (trangCuoi != null) {
                setPagination((p) => ({ ...p, pageNumber: trangCuoi }));
                return;
            }
            setOrders(data.content || []);
            setPagination({
                pageNumber: data.pageable?.pageNumber || 0,
                pageSize: data.pageable?.pageSize || size,
                totalElements: data.totalElements || 0,
                totalPages: data.totalPages || 0,
            });
            setLoadError(false);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            if (silent) throw error;
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setLoadError(true);
            setOrders([]);
            setPagination(prev => ({ ...prev, totalElements: 0, totalPages: 0 }));
            toast.error('Không thể tải danh sách đơn mua hàng');
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
        // tabTrangThai là mảng hằng trong DON_MUA_HANG_TABS, chỉ đổi khi đổi tab
    }, [buildFilterArray, tabTrangThai, keyword, khoId, dateRange]);

    useEffect(() => {
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        if (!loadingInitial) queueMicrotask(() => fetchOrders(pagination.pageNumber, pagination.pageSize));
    }, [fetchOrders, loadingInitial, pagination.pageNumber, pagination.pageSize]);

    // ── Số trên tab: cùng phạm vi kho + mã đơn + kho + ngày đang lọc, chỉ thay trạng thái (R1, R2) ──
    const phamViKho = `${isRestrictedWarehouse}|${warehouses.map((w) => w.id).join(',')}`;
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        (ma) => countOrders(buildFilterArray({
            trangThai: DON_MUA_HANG_TABS.find((t) => t.ma === ma)?.trangThai,
            tuKhoa: keyword,
            kho: khoId,
            ngay: dateRange,
        })),
        `${phamViKho}|${keyword}|${khoId}|${dateRange.from}|${dateRange.to}`,
        { enabled: !loadingInitial }
    );

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: trạng thái đơn đổi khi kho nhận hàng, nhập kho
    const capNhat = useTaiLaiDanhSach({
        duLieu: orders,
        taiNgam: () => {
            tabCounts.reload();
            return fetchOrders(pagination.pageNumber, pagination.pageSize, { silent: true });
        },
        bat: !loading && !loadingInitial,
    });

    // ── Debounce ô tìm kiếm: không gọi API ở mỗi lần gõ phím ──
    useEffect(() => {
        const value = searchText.trim();
        if (value === keyword) return undefined;
        const timer = setTimeout(() => {
            setKeyword(value);
            setPagination((p) => ({ ...p, pageNumber: 0 }));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchText, keyword]);

    // ── Handlers (đổi bộ lọc thì về trang đầu) ──
    const toFirstPage = () => setPagination(prev => ({ ...prev, pageNumber: 0 }));

    const changeTab = (value) => {
        setTab(value);
        toFirstPage();
    };

    // Ghi kho lên URL (giữ tab đang chọn)
    const changeKho = (value) => {
        setTab(tab, { kho: value || null });
        toFirstPage();
    };

    const handleDateChange = (field, value) => {
        setDateRange(prev => ({ ...prev, [field]: value }));
        toFirstPage();
    };

    const applyKeyword = (value) => {
        setKeyword(value);
        toFirstPage();
    };

    const hasActiveFilters = Boolean(searchText.trim() || keyword || khoId || dateRange.from || dateRange.to);

    // "Xóa lọc": bỏ mã đơn + kho + ngày, giữ tab đang chọn
    const clearFilters = () => {
        setSearchText('');
        setKeyword('');
        setDateRange(prev => (prev.from || prev.to ? { from: '', to: '' } : prev));
        setTab(tab, { kho: null });
        toFirstPage();
    };

    const handleRefresh = () => {
        fetchOrders(pagination.pageNumber, pagination.pageSize);
        tabCounts.reload();
    };

    const handlePageChange = (p) => {
        if (p >= 0 && p < pagination.totalPages) {
            setPagination(prev => ({ ...prev, pageNumber: p }));
        }
    };

    const handlePageSizeChange = (s) => {
        setPagination(prev => ({ ...prev, pageNumber: 0, pageSize: s }));
    };

    const getSelectedWarehouseName = () => {
        if (!khoId) return 'Tất cả kho';
        return warehouses.find(w => String(w.id) === khoId)?.tenKho || 'Đang tải...';
    };

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = DON_MUA_HANG_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        count: loadError ? null : tabCounts.counts[t.ma],
    }));
    const emptyTabLabel = DON_MUA_HANG_TABS.find((t) => t.ma === tab)?.label;

    // Ghi chú phạm vi cho người chỉ xem kho mình phụ trách (R3)
    const scopeNote = !isRestrictedWarehouse || loadingInitial
        ? null
        : warehouses.length > 0
            ? `Kho bạn phụ trách: ${warehouses.map((w) => w.tenKho).join(', ')}`
            : 'Bạn chưa được phân công kho nào nên danh sách đang trống.';

    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                scope={scopeNote}
                actions={
                    <Button
                        className="gap-1.5 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                        onClick={() => navigate('/purchase-orders/create')}
                    >
                        <Plus className="size-4" /> Tạo đơn mua hàng
                    </Button>
                }
            />

            {/* ── Table (nhấn vào dòng để xem chi tiết đơn mua hàng) ── */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc đơn mua hàng theo trạng thái"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={clearFilters}
                    >
                        <SearchInput
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            onClear={() => { setSearchText(''); applyKeyword(''); }}
                            onKeyDown={e => { if (e.key === 'Enter') applyKeyword(searchText.trim()); }}
                            placeholder="Nhập mã đơn (VD: PO...)"
                            label="Tìm theo mã đơn mua hàng"
                            className="sm:w-[300px]"
                        />

                        {/* Kho nhập */}
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    aria-label="Lọc theo kho nhập"
                                    className="h-9 w-full justify-between border-bo-border bg-bo-surface px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[200px]"
                                    disabled={loadingInitial || warehouses.length === 0}
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
                                className="z-50 max-h-[300px] w-[240px] overflow-y-auto rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
                            >
                                <DropdownMenuItem
                                    onClick={() => changeKho('')}
                                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                >
                                    Tất cả kho
                                </DropdownMenuItem>
                                {warehouses.map(w => (
                                    <DropdownMenuItem
                                        key={w.id}
                                        onClick={() => changeKho(w.id)}
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

                        {/* Từ ngày / Đến ngày: nhãn nằm trong ô để hàng công cụ gọn một dòng */}
                        {[
                            { key: 'from', label: 'Từ ngày' },
                            { key: 'to', label: 'Đến ngày' },
                        ].map(({ key, label }) => (
                            <label
                                key={key}
                                className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-bo-surface pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto"
                            >
                                <Calendar className="size-4 shrink-0 text-bo-muted" />
                                <span className="shrink-0 text-xs text-bo-muted">{label}</span>
                                <Input
                                    type="date"
                                    aria-label={label}
                                    className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0"
                                    value={dateRange[key]}
                                    onChange={e => handleDateChange(key, e.target.value)}
                                />
                            </label>
                        ))}
                    </ListToolbar>
                }
                footer={
                    !loading && !loadingInitial && !loadError ? (
                        <TablePagination
                            page={pagination.pageNumber}
                            size={pagination.pageSize}
                            total={pagination.totalElements}
                            onPageChange={handlePageChange}
                            onSizeChange={handlePageSizeChange}
                            capNhat={capNhat}
                        />
                    ) : null
                }
            >
                {loading || loadingInitial ? (
                    <LoadingState label="Đang tải danh sách đơn mua hàng" />
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải danh sách đơn mua hàng. Vui lòng thử lại."
                        onRetry={handleRefresh}
                    />
                ) : orders.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy đơn mua hàng phù hợp"
                            description="Thử đổi mã đơn, kho hoặc khoảng ngày."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={ShoppingCart}
                            title={`Không có đơn mua hàng nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi đơn mua hàng."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeTab(TAB_MAC_DINH)}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ShoppingCart}
                            title="Chưa có đơn mua hàng"
                            description="Đơn mua hàng đang vận chuyển và đã nhận đủ sẽ hiển thị tại đây."
                        />
                    )
                ) : (
                    /* Bảng: khung giãn hết màn, thân bảng tự cuộn, tiêu đề cột đứng yên */
                    <table className="w-full min-w-[960px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mã đơn mua</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Nhà cung cấp</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày tạo</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                                <th className="h-10 px-3 text-right tabular-nums whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền</th>
                                <th className="h-10 w-32 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {orders.map((order, index) => {
                                const cfg = getDonMuaHangStatus(order.trangThai);
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
                                            <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-slate-600">
                                                <Calendar className="size-3.5 text-bo-muted" /> {formatDate(order.ngayTao)}
                                            </div>
                                        </td>

                                        <td className="whitespace-nowrap px-3 py-3">
                                            <StatusBadge quyTrinh="donMua" label={cfg.label} />
                                        </td>

                                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold text-bo-foreground">
                                            {order.tongTien != null ? formatCurrency(order.tongTien) : <span className="font-normal text-bo-muted">—</span>}
                                        </td>

                                        <td className="px-3 py-3">
                                            <RowActions>
                                                <RowActionButton
                                                    icon={Eye}
                                                    label="Xem chi tiết đơn"
                                                    onClick={() => navigate(`/purchase-orders/${order.id}`)}
                                                />
                                                {/* Nhập kho (Chỉ trạng thái 3 hoặc 5, và có quyền) */}
                                                {canCreateReceipt && (isStatus3 || isStatus5) && (
                                                    <RowActionButton
                                                        icon={PackagePlus}
                                                        label="Tạo phiếu nhập kho"
                                                        onClick={() => navigate(`/goods-receipts/create?poId=${order.id}`)}
                                                    />
                                                )}
                                            </RowActions>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>
        </PageContainer>
    );
}
