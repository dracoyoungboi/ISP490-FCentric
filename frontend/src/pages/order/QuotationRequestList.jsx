import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle, Calendar, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
    Clock, CreditCard, DollarSign, Eye, FileText, ListChecks, Loader2, Package, Plus,
    RefreshCw, Send, ShoppingCart, Ship, Warehouse, XCircle,
} from 'lucide-react';
import apiClient from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import FilterBar from "@/components/shared/FilterBar";
import SearchInput from "@/components/shared/SearchInput";
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
// Chỉ tập trung vào 3 và 5 cho Parent Row
const PR_STATUS = {
    3: { label: 'Đã gửi yêu cầu báo giá', tone: 'info', icon: FileText },
    5: { label: 'Đã chuyển thành đơn mua hàng', tone: 'success', icon: Ship },
};

const PO_STATUS = {
    0: { label: 'Đã xoá', tone: 'danger', icon: XCircle },
    1: { label: 'Đã gửi YC báo giá', tone: 'neutral', icon: Send },
    2: { label: 'Đã nhận báo giá', tone: 'info', icon: FileText },
    3: { label: 'Đã chuyển thành đơn mua hàng', tone: 'warning', icon: CheckCircle },
    4: { label: 'Từ chối báo giá', tone: 'danger', icon: XCircle },
    5: { label: 'Đã thanh toán', tone: 'success', icon: CreditCard },
};

function getPaymentTooltip(trangThai) {
    switch (trangThai) {
        case 0: return 'Đơn đã bị xoá, không thể thanh toán';
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

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [warehouses, setWarehouses] = useState([]);

    const [pagination, setPagination] = useState({ pageNumber: 0, pageSize: 10, totalElements: 0, totalPages: 0 });
    const [filters, setFilters] = useState({ soYeuCauMuaHang: '', khoId: '', trangThai: '' });
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    // Bộ đếm thời gian tự ẩn thông báo (5s) — dọn dẹp khi unmount
    const notifyTimerRef = useRef(null);

    const showNotification = (type, msg) => {
        if (type === 'success') { setSuccess(msg); setError(null); }
        else { setError(msg); setSuccess(null); }
        if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
        notifyTimerRef.current = setTimeout(() => { setSuccess(null); setError(null); }, 5000);
    };

    useEffect(() => () => {
        if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
    }, []);

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

    // ── Fetch requests ────────────────────────────────────────────────────────
    const fetchRequests = useCallback(async (page = 0, size = 10) => {
        setLoading(true);
        setError(null);
        try {
            const filterArray = [];

            // CHÚ Ý: Mặc định luôn lọc parent row là 3 và 5
            if (filters.trangThai && filters.trangThai !== 'all') {
                filterArray.push({ fieldName: "trangThai", operation: "EQUALS", value: parseInt(filters.trangThai), logicType: "AND" });
            } else {
                filterArray.push({ fieldName: "trangThai", operation: "IN", value: [3, 5], logicType: "AND" });
            }

            if (filters.soYeuCauMuaHang) filterArray.push({ fieldName: "soYeuCauMuaHang", operation: "LIKE", value: filters.soYeuCauMuaHang, logicType: "AND" });
            if (filters.khoId && filters.khoId !== 'all') filterArray.push({ fieldName: "khoNhap.id", operation: "EQUALS", value: parseInt(filters.khoId), logicType: "AND" });
            if (dateRange.from) filterArray.push({ fieldName: "ngayTao", operation: "GREATER_THAN_OR_EQUAL", value: dateRange.from, logicType: "AND" });
            if (dateRange.to) filterArray.push({ fieldName: "ngayTao", operation: "LESS_THAN_OR_EQUAL", value: dateRange.to + 'T23:59:59', logicType: "AND" });

            const response = await apiClient.post('/api/v1/yeu-cau-mua-hang/filter', {
                filters: filterArray,
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
                page, size,
            });

            if (response?.data?.data) {
                setRequests(response.data.data.content || []);
                setPagination({
                    pageNumber: response.data.data.pageable?.pageNumber ?? 0,
                    pageSize: response.data.data.pageable?.pageSize ?? size,
                    totalElements: response.data.data.totalElements || 0,
                    totalPages: response.data.data.totalPages || 0,
                });
            }
        } catch (e) {
            console.error('Error fetching purchase requests:', e);
            showNotification('error', 'Không thể tải danh sách. Vui lòng thử lại!');
        } finally {
            setLoading(false);
        }
    }, [filters, dateRange]);

    // Chỉ chạy một lần khi mount: nạp danh sách kho + trang đầu tiên.
    // (Giữ nguyên hành vi cũ: đổi bộ lọc KHÔNG tự động gọi lại API.)
    const didInitRef = useRef(false);
    useEffect(() => {
        if (didInitRef.current) return;
        didInitRef.current = true;

        const init = async () => {
            try {
                const ware = await purchaseOrderService.getUniqueWarehouses();
                setWarehouses(ware);
            } catch (e) { console.error('Error loading warehouses:', e); }
        };
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        queueMicrotask(() => {
            init();
            fetchRequests(0, 10);
        });
    }, [fetchRequests]);

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

    // ── Filter helpers ────────────────────────────────────────────────────────
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
        fetchRequests(0, pagination.pageSize);
    };

    const clearFilters = () => {
        setFilters({ soYeuCauMuaHang: '', khoId: '', trangThai: '' });
        setDateRange({ from: '', to: '' });
        setPagination(prev => ({ ...prev, pageNumber: 0 }));
        setTimeout(() => fetchRequests(0, pagination.pageSize), 100);
    };

    const handlePageChange = (p) => {
        if (p >= 0 && p < pagination.totalPages) fetchRequests(p, pagination.pageSize);
    };

    const handlePageSizeChange = (s) => {
        setPagination(prev => ({ ...prev, pageNumber: 0, pageSize: s }));
        fetchRequests(0, s);
    };

    const getWarehouseName = () => {
        if (!filters.khoId || filters.khoId === 'all') return "Tất cả kho";
        return warehouses.find(w => w.id === parseInt(filters.khoId))?.tenKho || "Đang tải...";
    };

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalAccepted = requests.reduce((sum, r) => sum + (getAcceptedTotal(r) ?? 0), 0);
    const stats = [
        { label: 'Tổng yêu cầu', value: pagination.totalElements, icon: <FileText className="size-4" />, iconClass: 'bg-bo-primary-soft text-bo-primary' },
        { label: 'Giá trị chốt (hiện tại)', value: formatCurrency(totalAccepted), icon: <DollarSign className="size-4" />, iconClass: 'bg-bo-success-soft text-bo-success' },
        { label: 'Đã tạo báo giá', value: requests.filter(r => r.trangThai === 3).length, icon: <ShoppingCart className="size-4" />, iconClass: 'bg-purple-50 text-purple-600' },
        { label: 'Đang vận chuyển', value: requests.filter(r => r.trangThai === 5).length, icon: <Ship className="size-4" />, iconClass: 'bg-bo-warning-soft text-bo-warning' },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <PageContainer className="space-y-5">
            <PageHeader
                
                title="Yêu cầu báo giá"
                description="Theo dõi các yêu cầu mua hàng đã gửi nhà cung cấp và các báo giá nhận về."
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => fetchRequests(pagination.pageNumber, pagination.pageSize)}
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

            {/* Notifications */}
            {success && (
                <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-bo-success-soft px-4 py-3 text-sm text-bo-success shadow-sm">
                    <CheckCircle className="mt-0.5 size-4 shrink-0" />
                    <span className="font-medium">{success}</span>
                </div>
            )}
            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-bo-danger-soft px-4 py-3 text-sm text-bo-danger shadow-sm">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            {/* Stats */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map(({ label, value, icon, iconClass }) => (
                    <div key={label} className="rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-bo-muted">{label}</span>
                            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                                {icon}
                            </span>
                        </div>
                        <p className="mt-3 break-words text-xl font-bold tracking-tight text-bo-foreground">{value}</p>
                    </div>
                ))}
            </section>

            {/* Filters + Table */}
            <TableShell
                title="Danh sách quản lý"
                description="Bấm vào dòng để xem chi tiết yêu cầu, mở rộng để xem các báo giá con."
                toolbar={
                    <FilterBar
                        primary={
                            <SearchInput
                                value={filters.soYeuCauMuaHang}
                                onChange={e => handleFilterChange('soYeuCauMuaHang', e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Tìm theo mã yêu cầu..."
                                label="Tìm theo mã yêu cầu"
                                className="sm:max-w-xs"
                            />
                        }
                        filters={
                            <>
                                {/* Kho nhập */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-9 justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                            disabled={warehouses.length === 0}
                                        >
                                            <span className="flex items-center gap-2 overflow-hidden">
                                                <Warehouse className="size-3.5 shrink-0 text-bo-muted" />
                                                <span className="truncate">{getWarehouseName()}</span>
                                            </span>
                                            <ChevronDown className="size-4 shrink-0 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="backoffice-user-menu z-50 max-h-[300px] w-[240px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                                        <DropdownMenuItem onClick={() => handleFilterChange('khoId', 'all')} className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                                            Tất cả kho
                                        </DropdownMenuItem>
                                        {warehouses.map(w => (
                                            <DropdownMenuItem key={w.id} onClick={() => handleFilterChange('khoId', w.id)} className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{w.tenKho}</span>
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
                                            className="h-9 justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                        >
                                            <span className="truncate">
                                                {filters.trangThai && filters.trangThai !== 'all' ? PR_STATUS[filters.trangThai]?.label : "Tất cả"}
                                            </span>
                                            <ChevronDown className="size-4 shrink-0 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="backoffice-user-menu z-50 w-[240px] rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                                        <DropdownMenuItem onClick={() => handleFilterChange('trangThai', 'all')} className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                                            Tất cả
                                        </DropdownMenuItem>
                                        {Object.entries(PR_STATUS).map(([key, cfg]) => {
                                            const Icon = cfg.icon;
                                            return (
                                                <DropdownMenuItem key={key} onClick={() => handleFilterChange('trangThai', key)} className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                                                    <div className="flex items-center gap-2"><Icon className="size-4 text-bo-muted" />{cfg.label}</div>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Khoảng ngày */}
                                <Input
                                    type="date"
                                    aria-label="Từ ngày"
                                    className="h-9 w-[150px] border-bo-border bg-white text-sm"
                                    value={dateRange.from}
                                    onChange={e => handleDateChange('from', e.target.value)}
                                />
                                <Input
                                    type="date"
                                    aria-label="Đến ngày"
                                    className="h-9 w-[150px] border-bo-border bg-white text-sm"
                                    value={dateRange.to}
                                    onChange={e => handleDateChange('to', e.target.value)}
                                />
                            </>
                        }
                        actions={
                            <>
                                <Button variant="outline" onClick={clearFilters} className="h-9 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
                                    Đặt lại
                                </Button>
                                <Button onClick={handleSearch} className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                                    Tìm kiếm
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
                                    {[5, 10, 20, 50, 100].map(s => (
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
                        {loading ? (
                            <tr>
                                <td colSpan={9}>
                                    <LoadingState rows={5} label="Đang tải danh sách yêu cầu báo giá" />
                                </td>
                            </tr>
                        ) : requests.length === 0 ? (
                            <tr>
                                <td colSpan={9}>
                                    <EmptyState
                                        icon={Package}
                                        title="Không tìm thấy yêu cầu báo giá nào"
                                        description="Vui lòng thử thay đổi bộ lọc hoặc tạo yêu cầu báo giá mới."
                                        action={
                                            <Button
                                                onClick={() => navigate('/quotation-requests/create')}
                                                className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                            >
                                                <Plus className="size-4" /> Tạo yêu cầu báo giá
                                            </Button>
                                        }
                                    />
                                </td>
                            </tr>
                        ) : requests.map((req) => {
                            const isExpanded = expandedRows.has(req.id);
                            const prCfg = PR_STATUS[req.trangThai] ?? { label: 'Không rõ', tone: 'neutral', icon: Clock };
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
                                                            title="Danh sách Báo giá từ NCC thuộc yêu cầu này"
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
            </TableShell>
        </PageContainer>
    );
}
