import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/lib/thongBaoNhanh';
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
    ChevronDown, Calendar,
    Plus, Warehouse, CheckCircle,
    XCircle, Loader2, Package, SearchX,
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
import TablePagination from '@/components/shared/TablePagination';
import TableShell from '@/components/shared/TableShell';
import { SO_DONG_MAC_DINH } from '@/constants/phanTrang';
import { formatDate } from '@/utils/formatters';

import { YEU_CAU_NHAP_HANG_TABS, getYeuCauNhapHangStatus } from '@/constants/yeuCauNhapHang';
import useDemTheoTrangThai from '@/hooks/useDemTheoTrangThai';
import useTaiLaiDanhSach from '@/hooks/useTaiLaiDanhSach';
import { trangCuoiNeuVuot } from '@/lib/tinhTaiLai';
import purchaseRequestService from '@/services/purchaseRequestService';
import apiClient from '@/services/apiClient';
import { getMineKhoList } from '@/services/khoService';
import { VAI_TRO_TAO_YEU_CAU_NHAP } from '@/constants/vaiTroTaoYeuCauNhap';
import { KHO_LAM_VIEC_EVENT, coQuyenTaiKhoLamViec } from '@/utils/khoLamViec';
import { hasAnyRole } from '@/utils/roles';
import { t } from "@/i18n";

// Nút "Tạo yêu cầu nhập hàng": đúng điều kiện máy chủ (POST /nghiep-vu/yeu-cau-mua-hang/create) — vai trò lập yêu cầu
// kèm quyền tao_don_mua_hang ở nơi làm việc (quản trị viên luôn có)
const coQuyenTaoYeuCau = () => hasAnyRole(VAI_TRO_TAO_YEU_CAU_NHAP) && coQuyenTaiKhoLamViec('tao_don_mua_hang');

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

// Tên trạng thái lấy từ constants/yeuCauNhapHang, màu thẻ từ constants/trangThai (thẻ R8 không kèm icon).

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=, kho đang lọc trên ?kho=
const TAB_MAS = YEU_CAU_NHAP_HANG_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = 'tat-ca';
const TONE_TAB = { 'cho-duyet': 'warning' };

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
    // Đổi nơi làm việc (đáy menu, tab khác) thì xét lại quyền tạo
    const [canCreate, setCanCreate] = useState(coQuyenTaoYeuCau);
    useEffect(() => {
        const nghe = () => setCanCreate(coQuyenTaoYeuCau());
        window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
        window.addEventListener('storage', nghe);
        return () => {
            window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
            window.removeEventListener('storage', nghe);
        };
    }, []);

    // Pagination
    const [pagination, setPagination] = useState({ pageNumber: 0, pageSize: SO_DONG_MAC_DINH, totalElements: 0, totalPages: 0 });

    // Filters: tab trạng thái + kho đọc từ URL (F5 / link từ Tổng quan mở đúng tab); ngày giữ trong state
    const tabParam = searchParams.get('trangThai');
    const tab = TAB_MAS.includes(tabParam) ? tabParam : TAB_MAC_DINH;
    const tabTrangThai = YEU_CAU_NHAP_HANG_TABS.find((tb) => tb.ma === tab)?.trangThai ?? null;
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
    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchRequests = useCallback(async (page = 0, size = SO_DONG_MAC_DINH, { silent = false } = {}) => {
        // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const res = await purchaseRequestService.filter({
                filters: buildFilterArray({ trangThai: tabTrangThai, kho: khoId, ngay: dateRange }),
                sorts: [{ fieldName: 'ngayTao', direction: 'DESC' }],
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
            setRequests(data.content || []);
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
            // Không giữ dòng + tổng số của lần tải trước: tránh hiện số liệu cũ như thể khớp bộ lọc mới (R9).
            // Giữ lỗi để ô lỗi phân biệt 403 (không có quyền: không "Thử lại", không thông báo nhanh)
            setLoadError(error);
            setRequests([]);
            setPagination(prev => ({ ...prev, totalElements: 0, totalPages: 0 }));
            if (error?.response?.status !== 403) toast.error(t("Không thể tải danh sách yêu cầu mua hàng"));
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
            trangThai: YEU_CAU_NHAP_HANG_TABS.find((tb) => tb.ma === ma)?.trangThai,
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

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: kho tạo yêu cầu, mua hàng duyệt trên cùng danh sách
    const capNhat = useTaiLaiDanhSach({
        duLieu: requests,
        taiNgam: () => {
            reloadCounts();
            return fetchRequests(pagination.pageNumber, pagination.pageSize, { silent: true });
        },
        bat: !loading && !loadingInitial,
    });

    // ── Approve / Reject ──
    const handleApprove = async (id, trangThai) => {
        setSubmitting(true);
        try {
            await purchaseRequestService.approve(id, trangThai);
            toast.success(trangThai === 2 ? t("Đã duyệt yêu cầu.") : t("Đã từ chối yêu cầu."));
            setApprovingId(null);
            fetchRequests(pagination.pageNumber, pagination.pageSize);
            reloadCounts();
        } catch (err) {
            toast.error(err.response?.data?.message || t("Thao tác thất bại"));
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

    const getSelectedWarehouseName = () => {
        if (!khoId) return t("Tất cả kho");
        return warehouses.find(w => String(w.id) === khoId)?.tenKho || t("Đang tải...");
    };

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = YEU_CAU_NHAP_HANG_TABS.map((tb) => ({
        value: tb.ma,
        label: t(tb.label),
        tone: TONE_TAB[tb.ma],
        count: loadError ? null : tabCounts.counts[tb.ma],
    }));

    // Phạm vi cho người chỉ xem kho của mình (R3): nhãn "Nơi làm việc" chung (ListPageHeader)
    const noiLamViec = !isRestrictedWarehouse || loadingInitial ? null : warehouses;

    const pendingCount = canApprove && tab !== 'cho-duyet' ? choDuyet.counts['cho-duyet'] : null;
    const emptyTabLabel = t(YEU_CAU_NHAP_HANG_TABS.find((tb) => tb.ma === tab)?.label);

    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                noiLamViec={noiLamViec}
                actions={
                    // Quản lý kho chỉ duyệt, không lập yêu cầu; vai trò lập mà chưa có quyền tạo ở nơi làm việc: không hiện
                    canCreate ? (
                        <Button
                            className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                            onClick={() => navigate('/purchase-requests/create')}
                        >
                            <Plus className="size-4" />{t("Tạo yêu cầu nhập hàng")}
                        </Button>
                    ) : null
                }
            />

            <AttentionBar
                count={pendingCount}
                actionLabel={t("Xem yêu cầu chờ duyệt")}
                onAction={showPending}
            >
                <strong className="font-semibold">{t("{{soYeuCau}} yêu cầu", { count: pendingCount ?? 0, soYeuCau: pendingCount?.toLocaleString('vi-VN') })}</strong> {t("đang chờ duyệt.")}
            </AttentionBar>

            {/* ── Table ── */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label={t("Lọc yêu cầu nhập hàng theo trạng thái")}
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
                                    aria-label={t("Lọc theo kho nhập")}
                                    className="h-9 w-full justify-between border-bo-border bg-bo-surface px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[200px]"
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
                                className="z-50 max-h-[400px] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
                            >
                                <DropdownMenuItem
                                    onClick={() => updateUrl({ kho: '' })}
                                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                >
                                    {t("Tất cả kho")}
                                </DropdownMenuItem>
                                {warehouses.map(w => (
                                    <DropdownMenuItem
                                        key={w.id}
                                        onClick={() => updateUrl({ kho: w.id })}
                                        className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900">{w.tenKho}</span>
                                            {w.maKho && <span className="text-xs text-bo-muted">{t("Mã: {{maKho}}", { maKho: w.maKho })}</span>}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Từ ngày / Đến ngày: nhãn nằm trong ô để hàng công cụ gọn một dòng */}
                        {[
                            { key: 'from', label: t("Từ ngày") },
                            { key: 'to', label: t("Đến ngày") },
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
                                    onChange={e => { setDateRange(p => ({ ...p, [key]: e.target.value })); setPagination(p => ({ ...p, pageNumber: 0 })); }}
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
                            onPageChange={(pg) => setPagination(p => ({ ...p, pageNumber: pg }))}
                            onSizeChange={(size) => setPagination(p => ({ ...p, pageNumber: 0, pageSize: size }))}
                            capNhat={capNhat}
                        />
                    ) : null
                }
            >
                {loading || loadingInitial ? (
                    <LoadingState rows={5} label={t("Đang tải danh sách yêu cầu nhập hàng")} />
                ) : loadError ? (
                    <ErrorState
                        description={t("Không thể tải danh sách yêu cầu nhập hàng. Vui lòng thử lại.")}
                        error={loadError}
                        onRetry={handleRefresh}
                    />
                ) : requests.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title={t("Không tìm thấy yêu cầu nhập hàng phù hợp")}
                            description={t("Thử đổi kho hoặc khoảng ngày.")}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    {t("Xóa lọc")}
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={Package}
                            title={t("Không có yêu cầu nào ở trạng thái \"{{emptyTabLabel}}\"", { emptyTabLabel })}
                            description={t("Chọn tab Tất cả để xem mọi yêu cầu nhập hàng.")}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeTab(TAB_MAC_DINH)}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    {t("Xem tất cả")}
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Package}
                            title={t("Chưa có yêu cầu nhập hàng")}
                            description={t("Tạo yêu cầu nhập hàng khi kho cần nhập thêm hàng.")}
                        />
                    )
                ) : (
                    <>
                    {/* Điện thoại: mỗi yêu cầu một thẻ — mã yêu cầu + trạng thái, kho nhập, ngày tạo · người tạo + ngày giao DK */}
                    <ul className="divide-y divide-bo-border md:hidden">
                        {requests.map((req) => {
                            const cfg = getYeuCauNhapHangStatus(req.trangThai);
                            return (
                                <li key={req.id}>
                                    <Link to={`/purchase-requests/${req.id}`} className="grid grid-cols-1 gap-1 px-4 py-3 active:bg-bo-surface-subtle">
                                        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                            <span className="min-w-0 truncate text-[15px] font-semibold text-bo-primary">{req.soYeuCauMuaHang || `#${req.id}`}</span>
                                            <StatusBadge quyTrinh="yeuCauNhap" label={cfg.label} />
                                        </span>
                                        <span className="flex min-w-0 items-center gap-2 text-sm">
                                            <span className="min-w-0 truncate font-semibold text-bo-foreground">{req.khoNhap?.tenKho || '-'}</span>
                                            {req.khoNhap?.maKho ? <span className="shrink-0 text-bo-muted">{req.khoNhap.maKho}</span> : null}
                                        </span>
                                        <span className="flex items-baseline justify-between gap-3 text-[13px] text-bo-muted">
                                            <span className="min-w-0 truncate">
                                                {formatDate(req.ngayTao)}{req.nguoiTao?.hoTen ? ` · ${req.nguoiTao.hoTen}` : ''}
                                            </span>
                                            {req.ngayGiaoDuKien ? (
                                                <span className="shrink-0">{t("Ngày giao DK")} {formatDate(req.ngayGiaoDuKien)}</span>
                                            ) : null}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    {/* Bảng: khung giãn hết màn, thân bảng tự cuộn, tiêu đề cột đứng yên.
                        Máy tính bảng dọc (cảm ứng): bỏ cột STT, Ngày tạo (đưa thành dòng phụ dưới người tạo) để không vuốt ngang */}
                    <table className="w-full min-w-[900px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("STT")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Kho nhập")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Người tạo")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Ngày tạo")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Ngày giao DK")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Trạng thái")}</th>
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
                                        <td className="px-3 py-3 text-center text-xs text-bo-muted cam-ung:max-lg:hidden">
                                            {pagination.pageNumber * pagination.pageSize + index + 1}
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="font-semibold text-bo-foreground">{req.khoNhap?.tenKho || '-'}</p>
                                            <p className="text-xs text-bo-muted">{req.khoNhap?.maKho}</p>
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="font-semibold text-bo-foreground">{req.nguoiTao?.hoTen || '-'}</p>
                                            <p className="text-xs text-bo-muted">{req.nguoiTao?.email}</p>
                                            <p className="mt-0.5 hidden text-xs text-bo-muted cam-ung:max-lg:block">{formatDate(req.ngayTao)}</p>
                                        </td>
                                        <td className="px-3 py-3 cam-ung:max-lg:hidden">
                                            <div className="flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                                                <Calendar className="size-3.5 shrink-0 text-slate-400" />{formatDate(req.ngayTao)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                                                <Calendar className="size-3.5 shrink-0 text-slate-400" />{formatDate(req.ngayGiaoDuKien)}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3">
                                            <StatusBadge quyTrinh="yeuCauNhap" label={cfg.label} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </>
                )}
            </TableShell>

            <AlertDialog open={!!approvingId} onOpenChange={(open) => !open && setApprovingId(null)}>
                <AlertDialogContent className="rounded-lg border border-bo-border bg-bo-surface text-bo-foreground shadow-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={`flex items-center gap-2 ${approvingId?.action === 'approve' ? 'text-bo-success' : 'text-bo-danger'}`}>
                            {approvingId?.action === 'approve' ? <CheckCircle className="size-5" /> : <XCircle className="size-5" />}
                            {approvingId?.action === 'approve' ? t("Xác nhận duyệt yêu cầu") : t("Xác nhận từ chối yêu cầu")}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-bo-muted">
                            {t("Bạn có chắc chắn muốn")} <strong>{approvingId?.action === 'approve' ? t("duyệt") : t("từ chối")}</strong> {t("yêu cầu nhập hàng")} <strong>#{approvingId?.id}</strong>?
                            <br /><br />
                            {approvingId?.action === 'approve'
                                ? t("Sau khi duyệt, có thể gửi báo giá đến nhà cung cấp để tạo đơn báo giá tương ứng.")
                                : t("Hành động từ chối yêu cầu này không thể hoàn tác.")
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={submitting}
                            onClick={() => setApprovingId(null)}
                            className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            {t("Hủy")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleApprove(approvingId.id, approvingId?.action === 'approve' ? 2 : 4)}
                            disabled={submitting}
                            className={approvingId?.action === 'approve' ? 'bg-bo-success text-white hover:bg-bo-success/90' : 'bg-bo-danger text-white hover:bg-bo-danger/90'}
                        >
                            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            {approvingId?.action === 'approve' ? t("Duyệt yêu cầu") : t("Từ chối yêu cầu")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}
