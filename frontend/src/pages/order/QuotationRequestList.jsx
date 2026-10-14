import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Calendar, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
    Clock, CreditCard, Eye, FileText, Package, Plus,
    RefreshCw, SearchX, Send, ShoppingCart, Warehouse, XCircle,
} from 'lucide-react';
import apiClient from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import PageContainer from "@/components/backoffice/PageContainer";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import { YEU_CAU_BAO_GIA_TABS, YEU_CAU_NHAP_HANG_STATUS } from "@/constants/yeuCauNhapHang";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import purchaseOrderService from "../../services/purchaseOrderService";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJwt(token) {
    try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
    catch { return null; }
}
function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

const formatCurrency = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

// ─── Status configs ────────────────────────────────────────────────────────────
// Dòng yêu cầu chỉ có 3 và 5: tên lấy từ constants/yeuCauNhapHang (một tên cho danh sách, chi tiết, bản in);
// màu giữ như trang này đang dùng.
const PR_STATUS = {
    3: { label: YEU_CAU_NHAP_HANG_STATUS[3].label, tone: 'info' },
    5: { label: YEU_CAU_NHAP_HANG_STATUS[5].label, tone: 'success' },
};

// Tab trạng thái (bố cục A+G) — mã tab trên URL ?trangThai=, kho đang lọc trên ?kho=
const TAB_MAS = YEU_CAU_BAO_GIA_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = 'tat-ca';
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
const API_FILTER = '/api/v1/yeu-cau-mua-hang/filter';

// ─── Điều kiện lọc dùng chung cho danh sách và số trên tab ─────────────────────
// Trang chỉ gồm yêu cầu ở trạng thái 3 và 5 (tab Tất cả = cả hai).
function buildFilterArray({ trangThai, tuKhoa, kho, ngay }) {
    const filterArray = [];

    if (trangThai.length === 1) {
        filterArray.push({ fieldName: "trangThai", operation: "EQUALS", value: trangThai[0], logicType: "AND" });
    } else {
        filterArray.push({ fieldName: "trangThai", operation: "IN", value: trangThai, logicType: "AND" });
    }

    if (tuKhoa) filterArray.push({ fieldName: "soYeuCauMuaHang", operation: "LIKE", value: tuKhoa, logicType: "AND" });
    if (kho) filterArray.push({ fieldName: "khoNhap.id", operation: "EQUALS", value: parseInt(kho), logicType: "AND" });
    if (ngay.from) filterArray.push({ fieldName: "ngayTao", operation: "GREATER_THAN_OR_EQUAL", value: ngay.from, logicType: "AND" });
    if (ngay.to) filterArray.push({ fieldName: "ngayTao", operation: "LESS_THAN_OR_EQUAL", value: ngay.to + 'T23:59:59', logicType: "AND" });

    return filterArray;
}

async function countRequests(filters) {
    const res = await apiClient.post(API_FILTER, { filters, sorts: [], page: 0, size: 1 });
    return res?.data?.data?.totalElements ?? 0;
}

const PO_STATUS = {
    0: { label: 'Đã xóa', tone: 'danger', icon: XCircle },
    1: { label: 'Đã gửi YC báo giá', tone: 'neutral', icon: Send },
    2: { label: 'Đã nhận báo giá', tone: 'info', icon: FileText },
    3: { label: 'Đã chuyển thành đơn mua hàng', tone: 'warning', icon: CheckCircle },
    4: { label: 'Từ chối báo giá', tone: 'danger', icon: XCircle },
    5: { label: 'Đã thanh toán', tone: 'success', icon: CreditCard },
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

// ─── Sub-component: PO rows inside expandable panel ───────────────────────────
// Ghi chú: UI duyệt/từ chối báo giá chưa từng được render (dead UI từ bản cũ).
function DonMuaHangRows({ donMuaHangs = [], navigate }) {
    if (donMuaHangs.length === 0) {
        return (
            <tr>
                <td colSpan={9}>
                    <EmptyState
                        icon={ShoppingCart}
                        title="Chưa có đơn mua hàng (báo giá) nào"
                        description="Các báo giá gửi tới nhà cung cấp sẽ hiển thị tại đây."
                        className="min-h-0 py-8"
                    />
                </td>
            </tr>
        );
    }

    return donMuaHangs.map((po) => {
        const cfg = PO_STATUS[po.trangThai] ?? { label: 'Không rõ', tone: 'neutral', icon: Clock };
        const isAccepted = po.trangThai === 3 || po.trangThai === 5;
        const canPay = po.trangThai === 3;

        return (
            <tr
                key={po.id}
                onClick={() => navigate(`/quotation/${po.id}`)}
                className="cursor-pointer border-b border-bo-border transition-colors last:border-0 hover:bg-bo-surface-subtle"
            >
                <td className="w-12 pl-6" />

                <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                        <div className="size-1.5 shrink-0 rounded-full bg-bo-primary" />
                        <span className="text-[13px] font-semibold text-bo-foreground">
                            {po.soDonMua?.replace(/^PO/, 'Q-')}
                        </span>
                    </div>
                </td>

                <td className="px-3 py-3">
                    <p className="max-w-[150px] truncate text-[13px] font-semibold text-bo-foreground">{po.nhaCungCap?.tenNhaCungCap}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-bo-muted">{po.nhaCungCap?.maNhaCungCap}</p>
                </td>

                <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-bo-muted">
                        <Calendar className="size-3 shrink-0" /> {formatDate(po.ngayDatHang)}
                    </div>
                </td>

                <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-bo-muted">
                        <Calendar className="size-3 shrink-0" /> {formatDate(po.ngayGiaoDuKien)}
                    </div>
                </td>

                <td className="px-3 py-3">
                    <StatusBadge label={cfg.label} tone={cfg.tone} />
                </td>

                <td className="max-w-[120px] truncate px-3 py-3 text-[13px] font-medium text-bo-muted">
                    {po.nguoiTao?.hoTen || '-'}
                </td>

                <td className="px-3 py-3 text-right">
                    <span className={`text-[14px] font-bold ${isAccepted ? 'text-bo-success' : 'text-bo-foreground'}`}>
                        {formatCurrency(po.tongTien)}
                    </span>
                    {isAccepted && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-bo-success">Đã chốt</p>}
                </td>

                <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <TooltipProvider>
                        <div className="flex items-center justify-center gap-1">
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
    });
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function QuotationRequestList() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [expandedRows, setExpandedRows] = useState(new Set());
    // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
    const requestIdRef = useRef(0);

    const [warehouses, setWarehouses] = useState([]);
    const [khoDaTai, setKhoDaTai] = useState(false);

    const [pagination, setPagination] = useState({ pageNumber: 0, pageSize: 10, totalElements: 0, totalPages: 0 });
    // Ô tìm kiếm chỉ áp dụng khi nhấn Enter (giữ hành vi cũ): searchText là chữ đang gõ, keyword là từ khóa đang lọc
    const [searchText, setSearchText] = useState('');
    const [keyword, setKeyword] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    // Tab trạng thái trên URL ?trangThai= (F5 / quay lại từ chi tiết vẫn đúng tab)
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    const tabTrangThai = YEU_CAU_BAO_GIA_TABS.find((t) => t.ma === tab)?.trangThai;

    // Kho trên URL ?kho=. Lúc danh sách kho chưa tải xong vẫn nhận mã kho dạng số để không tải danh sách 2 lần;
    // tải xong thì chỉ nhận kho có trong danh sách.
    const khoParam = searchParams.get('kho') ?? '';
    const khoId = khoDaTai
        ? (warehouses.some((w) => String(w.id) === khoParam) ? khoParam : '')
        : (/^\d+$/.test(khoParam) ? khoParam : '');

    // ── Load auth ─────────────────────────────────────────────────────────────
    // Ghi chú: giữ nguyên request get-by-id như bản cũ; kết quả vaiTro từng chỉ
    // nuôi UI duyệt báo giá (dead UI chưa từng render) nên không còn lưu state.
    useEffect(() => {
        const loadAuth = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) return;
                const payload = parseJwt(token);
                if (!payload?.id) return;
                const res = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
                parseRoles(res.data?.data?.vaiTro);
            } catch (e) {
                console.error('Auth error:', e);
            }
        };
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        queueMicrotask(() => loadAuth());
    }, []);

    // ── Danh sách kho cho ô lọc kho (chạy một lần khi mount) ──────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const ware = await purchaseOrderService.getUniqueWarehouses();
                setWarehouses(ware);
            } catch (e) {
                console.error('Error loading warehouses:', e);
            } finally {
                setKhoDaTai(true);
            }
        };
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        queueMicrotask(() => init());
    }, []);

    // ── Fetch requests ────────────────────────────────────────────────────────
    const fetchRequests = useCallback(async (page = 0, size = 10) => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const response = await apiClient.post(API_FILTER, {
                filters: buildFilterArray({ trangThai: tabTrangThai, tuKhoa: keyword, kho: khoId, ngay: dateRange }),
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
                page, size,
            });
            if (requestId !== requestIdRef.current) return;

            const data = response?.data?.data || {};
            setRequests(data.content || []);
            setPagination({
                pageNumber: data.pageable?.pageNumber ?? 0,
                pageSize: data.pageable?.pageSize ?? size,
                totalElements: data.totalElements || 0,
                totalPages: data.totalPages || 0,
            });
            setLoadError(false);
        } catch (e) {
            if (requestId !== requestIdRef.current) return;
            console.error('Error fetching purchase requests:', e);
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setLoadError(true);
            setRequests([]);
            setPagination(prev => ({ ...prev, totalElements: 0, totalPages: 0 }));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
        // tabTrangThai là mảng hằng trong YEU_CAU_BAO_GIA_TABS, chỉ đổi khi đổi tab
    }, [tabTrangThai, keyword, khoId, dateRange]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect; tải lại ngay khi tab / bộ lọc / trang đổi.
    useEffect(() => {
        queueMicrotask(() => fetchRequests(pagination.pageNumber, pagination.pageSize));
    }, [fetchRequests, pagination.pageNumber, pagination.pageSize]);

    // ── Số trên tab: cùng mã yêu cầu + kho + ngày đang lọc, chỉ thay trạng thái (R1) ──
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        (ma) => countRequests(buildFilterArray({
            trangThai: YEU_CAU_BAO_GIA_TABS.find((t) => t.ma === ma)?.trangThai,
            tuKhoa: keyword,
            kho: khoId,
            ngay: dateRange,
        })),
        `${keyword}|${khoId}|${dateRange.from}|${dateRange.to}`
    );

    // ── Toggle expand ─────────────────────────────────────────────────────────
    const toggleExpand = (id, e) => {
        e.stopPropagation();
        setExpandedRows(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // ── Tổng tiền đã chấp nhận ────────────────────────────────────────────────
    const getAcceptedTotal = (req) => {
        const accepted = (req.donMuaHangs || []).filter(po => po.trangThai === 3 || po.trangThai === 5);
        if (accepted.length === 0) return null;
        return accepted.reduce((sum, po) => sum + (Number(po.tongTien) || 0), 0);
    };

    // ── Filter helpers (đổi bộ lọc thì về trang đầu) ──────────────────────────
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

    const hasActiveFilters = Boolean(keyword || khoId || dateRange.from || dateRange.to);

    // "Xóa lọc": bỏ mã yêu cầu + kho + ngày, giữ tab đang chọn
    const clearFilters = () => {
        setSearchText('');
        setKeyword('');
        setDateRange(prev => (prev.from || prev.to ? { from: '', to: '' } : prev));
        setTab(tab, { kho: null });
        toFirstPage();
    };

    const handleRefresh = () => {
        fetchRequests(pagination.pageNumber, pagination.pageSize);
        tabCounts.reload();
    };

    const handlePageChange = (p) => {
        if (p >= 0 && p < pagination.totalPages) setPagination(prev => ({ ...prev, pageNumber: p }));
    };

    const handlePageSizeChange = (s) => {
        setPagination(prev => ({ ...prev, pageNumber: 0, pageSize: s }));
    };

    const getWarehouseName = () => {
        if (!khoId) return "Tất cả kho";
        return warehouses.find(w => String(w.id) === khoId)?.tenKho || "Đang tải...";
    };

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = YEU_CAU_BAO_GIA_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        count: loadError ? null : tabCounts.counts[t.ma],
    }));
    const emptyTabLabel = YEU_CAU_BAO_GIA_TABS.find((t) => t.ma === tab)?.label;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <PageContainer className="space-y-4">
            <ListPageHeader
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                            className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <RefreshCw className="size-4" /> Làm mới
                        </Button>
                        <Button
                            onClick={() => navigate('/quotation-requests/create')}
                            className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            <Plus className="size-4" /> Tạo yêu cầu báo giá
                        </Button>
                    </>
                }
            />

            {/* Bấm vào dòng để xem chi tiết yêu cầu, mở rộng để xem các báo giá con */}
            <TableShell
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc yêu cầu báo giá theo trạng thái"
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
                            onKeyDown={e => { if (e.key === 'Enter') applyKeyword(searchText.trim()); }}
                            onClear={() => { setSearchText(''); applyKeyword(''); }}
                            placeholder="Nhập mã yêu cầu rồi nhấn Enter"
                            label="Tìm theo mã yêu cầu"
                            className="sm:w-[300px]"
                        />

                        {/* Kho nhập */}
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    aria-label="Lọc theo kho nhập"
                                    className="h-9 w-full justify-between border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[200px]"
                                    disabled={warehouses.length === 0}
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        <Warehouse className="size-4 shrink-0 text-slate-400" />
                                        <span className="truncate">{getWarehouseName()}</span>
                                    </span>
                                    <ChevronDown className="ml-2 size-4 shrink-0 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="backoffice-user-menu z-50 max-h-[300px] w-[240px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                            >
                                <DropdownMenuItem onClick={() => changeKho('')} className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                                    Tất cả kho
                                </DropdownMenuItem>
                                {warehouses.map(w => (
                                    <DropdownMenuItem key={w.id} onClick={() => changeKho(w.id)} className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{w.tenKho}</span>
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
                                className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto"
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
                                    {PAGE_SIZE_OPTIONS.map(s => (
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
                            {" trong tổng số "}
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
                                <ChevronLeft className="size-3.5" />
                                Trước
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
                                Sau
                                <ChevronRight className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                }
            >
                {loading ? (
                    <LoadingState label="Đang tải danh sách yêu cầu báo giá" />
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải danh sách yêu cầu báo giá. Vui lòng thử lại."
                        onRetry={handleRefresh}
                    />
                ) : requests.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy yêu cầu báo giá phù hợp"
                            description="Thử đổi mã yêu cầu, kho hoặc khoảng ngày."
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
                            title={`Không có yêu cầu báo giá nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi yêu cầu báo giá."
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
                            title="Chưa có yêu cầu báo giá"
                            description="Tạo yêu cầu báo giá để gửi tới nhà cung cấp."
                            action={
                                <Button
                                    onClick={() => navigate('/quotation-requests/create')}
                                    className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                >
                                    <Plus className="size-4" /> Tạo yêu cầu báo giá
                                </Button>
                            }
                        />
                    )
                ) : (
                    <table className="w-full min-w-[1080px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3" />
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mã yêu cầu</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kho nhập</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày tạo</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày giao DK</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Người tạo</th>
                                <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền chốt</th>
                                <th className="h-10 w-24 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {requests.map((req) => {
                                const isExpanded = expandedRows.has(req.id);
                                const prCfg = PR_STATUS[req.trangThai] ?? { label: 'Không rõ', tone: 'neutral' };
                                const poCount = req.donMuaHangs?.length || 0;
                                const acceptedTotal = getAcceptedTotal(req);
                                const hasPos = poCount > 0;

                                return (
                                    <React.Fragment key={req.id}>
                                        {/* ── Parent row (Yêu Cầu) ── */}
                                        <tr
                                            onClick={() => navigate(`/quotation-requests/${req.id}`)}
                                            className={`cursor-pointer border-b border-bo-border transition-colors ${isExpanded ? 'bg-bo-primary-soft' : 'bg-white hover:bg-bo-surface-subtle'}`}
                                        >
                                            <td className="px-3 py-3 text-center" onClick={e => hasPos && toggleExpand(req.id, e)}>
                                                {hasPos ? (
                                                    <button className={`flex size-7 items-center justify-center rounded-md transition-colors ${isExpanded ? 'bg-bo-primary text-white' : 'bg-slate-100 text-bo-muted hover:bg-slate-200'}`}>
                                                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                                    </button>
                                                ) : (
                                                    <div className="flex size-7 items-center justify-center rounded-md border border-bo-border bg-bo-surface-subtle">
                                                        <div className="size-1.5 rounded-full bg-slate-300" />
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-3 py-3">
                                                <div className="flex flex-col items-start gap-1.5">
                                                    <span className="text-[14px] font-semibold tracking-tight text-bo-primary">#{req.soYeuCauMuaHang}</span>
                                                    {poCount > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-bo-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                                            <ShoppingCart className="size-3" />{poCount} báo giá
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-3 py-3">
                                                <p className="text-[13px] font-semibold text-bo-foreground">{req.khoNhap?.tenKho}</p>
                                                <p className="mt-0.5 font-mono text-[11px] text-bo-muted">{req.khoNhap?.maKho}</p>
                                            </td>

                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1.5 text-[12px] font-medium text-bo-muted">
                                                    <Calendar className="size-3.5 shrink-0" /> {formatDate(req.ngayTao)}
                                                </div>
                                            </td>

                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1.5 text-[12px] font-medium text-bo-muted">
                                                    <Calendar className="size-3.5 shrink-0" /> {formatDate(req.ngayGiaoDuKien)}
                                                </div>
                                            </td>

                                            <td className="px-3 py-3">
                                                <StatusBadge label={prCfg.label} tone={prCfg.tone} />
                                            </td>

                                            <td className="px-3 py-3 text-[13px] font-medium text-bo-muted">
                                                {req.nguoiTao?.hoTen || '-'}
                                            </td>

                                            <td className="px-3 py-3 text-right">
                                                {acceptedTotal !== null ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[15px] font-bold text-bo-success">{formatCurrency(acceptedTotal)}</span>
                                                        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-bo-success">Giá trị chốt</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[12px] font-medium italic text-bo-muted">Chưa có dữ liệu</span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="size-8 text-bo-muted hover:bg-bo-primary-soft hover:text-bo-primary"
                                                                onClick={() => navigate(`/quotation-requests/${req.id}`)}>
                                                                <Eye className="size-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Xem chi tiết yêu cầu</p></TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </td>
                                        </tr>

                                        {/* ── Expanded PO sub-table (Đơn báo giá con) ── */}
                                        {isExpanded && hasPos && (
                                            <tr>
                                                <td colSpan={9} className="border-b border-bo-border p-0">
                                                    <div className="bg-bo-surface-subtle pb-5 pt-3">
                                                        <div className="pl-4 pr-4 sm:pl-10 sm:pr-6">
                                                            <TableShell
                                                                title="Danh sách báo giá từ NCC thuộc yêu cầu này"
                                                                className="shadow-none"
                                                            >
                                                                <table className="w-full min-w-[900px] text-sm">
                                                                    <thead>
                                                                        <tr className="border-b border-bo-border bg-white">
                                                                            <th className="h-9 w-8" />
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Mã báo giá</th>
                                                                            <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Nhà cung cấp</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Ngày gửi</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Hạn chót</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Người tạo (NCC)</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Giá NCC báo</th>
                                                                            <th className="h-9 w-28 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        <DonMuaHangRows
                                                                            donMuaHangs={req.donMuaHangs}
                                                                            navigate={navigate}
                                                                        />
                                                                    </tbody>
                                                                </table>
                                                            </TableShell>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>
        </PageContainer>
    );
}
