import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Calendar, ChevronDown, ChevronUp,
    Eye, Package, Plus,
    SearchX, ShoppingCart, Warehouse,
} from 'lucide-react';
import apiClient from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageContainer from "@/components/backoffice/PageContainer";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { YEU_CAU_BAO_GIA_TABS, getYeuCauNhapHangStatus } from "@/constants/yeuCauNhapHang";
import { getBaoGiaNccStatus } from "@/constants/donMuaHang";
import { laDaChot, ngayGuiYeuCau, nhanTrangThaiBaoGia } from "@/components/order/chi-tiet-bao-gia/tinhBaoGia";
import { VAI_TRO_XEM_DON_MUA } from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import { VAI_TRO_GUI_YEU_CAU_BAO_GIA } from "@/constants/vaiTroGuiYeuCauBaoGia";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { cn } from "@/lib/utils";
import purchaseOrderService from "../../services/purchaseOrderService";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { hasAnyRole } from "@/utils/roles";
import { t } from "@/i18n";

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

// ─── Trạng thái ────────────────────────────────────────────────────────────────
// Dòng yêu cầu (chỉ 3 và 5) lấy tên từ constants/yeuCauNhapHang; dòng báo giá từng nhà cung cấp lấy từ
// BAO_GIA_NCC_STATUS ở constants/donMuaHang. Màu thẻ tra theo tên ở constants/trangThai.

// Tab trạng thái (bố cục A+G) — mã tab trên URL ?trangThai=, kho đang lọc trên ?kho=
const TAB_MAS = YEU_CAU_BAO_GIA_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = 'tat-ca';
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

// ─── Sub-component: PO rows inside expandable panel ───────────────────────────
// Ghi chú: UI duyệt/từ chối báo giá chưa từng được render (dead UI từ bản cũ).
// `xemGia`: người xem được đơn mua (VAI_TRO_XEM_DON_MUA) mới có cột "Giá NCC báo" (giá mua là giá vốn) và mở được
// Chi tiết báo giá (/quotation/:id cùng vai trò); vai trò khác (nhân viên bán hàng) chỉ xem dòng, không bấm, không cột Thao tác.
function DonMuaHangRows({ donMuaHangs = [], navigate, xemGia }) {
    if (donMuaHangs.length === 0) {
        return (
            <tr>
                <td colSpan={xemGia ? 8 : 6}>
                    <EmptyState
                        icon={ShoppingCart}
                        title={t("Chưa có đơn mua hàng (báo giá) nào")}
                        description={t("Các báo giá gửi tới nhà cung cấp sẽ hiển thị tại đây.")}
                        className="min-h-0 py-8"
                    />
                </td>
            </tr>
        );
    }

    return donMuaHangs.map((po) => {
        // Nhãn suy diễn như màn So sánh / Chi tiết báo giá: "Chờ báo giá" khi chưa có ngayBaoGia
        const cfg = { label: nhanTrangThaiBaoGia(po, getBaoGiaNccStatus(po.trangThai).label) };
        const isAccepted = laDaChot(po.trangThai);

        return (
            <tr
                key={po.id}
                onClick={xemGia ? () => navigate(`/quotation/${po.id}`) : undefined}
                className={cn(
                    "border-b border-bo-border transition-colors last:border-0",
                    xemGia && "cursor-pointer hover:bg-bo-surface-subtle",
                )}
            >
                <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                        <div className="size-1.5 shrink-0 rounded-full bg-bo-primary" />
                        <span className="text-[13px] font-semibold text-bo-foreground">
                            {po.soDonMua}
                        </span>
                    </div>
                    {/* Máy tính bảng dọc: ngày gửi + hạn chót thành hai dòng phụ (cột riêng bị ẩn) để bảng con vừa khung */}
                    <p className="mt-0.5 hidden whitespace-nowrap pl-3.5 text-[11px] text-bo-muted cam-ung:max-lg:block">
                        <span className="block">{t("Gửi {{ngayGui}}", { ngayGui: formatDate(ngayGuiYeuCau(po)) })}</span>
                        <span className="block">{t("Hạn {{ngayHan}}", { ngayHan: formatDate(po.ngayGiaoDuKien) })}</span>
                    </p>
                </td>

                <td className="px-3 py-3">
                    <p className="max-w-[120px] truncate text-[13px] font-semibold text-bo-foreground cam-ung:max-lg:max-w-[150px]" title={po.nhaCungCap?.tenNhaCungCap}>{po.nhaCungCap?.tenNhaCungCap}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-bo-muted">{po.nhaCungCap?.maNhaCungCap}</p>
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-bo-muted cam-ung:max-lg:hidden">
                    {formatDate(ngayGuiYeuCau(po))}
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-bo-muted cam-ung:max-lg:hidden">
                    {formatDate(po.ngayGiaoDuKien)}
                </td>

                <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge quyTrinh="yeuCauBaoGia" label={cfg.label} />
                </td>

                <td className="max-w-[120px] truncate px-3 py-3 text-[13px] font-medium text-bo-muted cam-ung:max-lg:hidden">
                    {po.nguoiTao?.hoTen || '-'}
                </td>

                {xemGia ? (
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                        {po.tongTien != null ? (
                            <span className="text-[13px] font-semibold text-bo-foreground">{formatCurrency(po.tongTien)}</span>
                        ) : (
                            <span className="text-[13px] text-bo-muted">—</span>
                        )}
                        {isAccepted && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-bo-success">{t("Đã chốt")}</p>}
                    </td>
                ) : null}

                {/* Chặn bấm lan ra dòng: nút Xem đã tự điều hướng, không để cú bấm điều hướng lần hai */}
                {xemGia ? (
                    <td className="px-3 py-3 cam-ung:max-lg:hidden" onClick={e => e.stopPropagation()}>
                        <RowActions>
                            <RowActionButton
                                icon={Eye}
                                label={t("Xem chi tiết báo giá")}
                                onClick={() => navigate(`/quotation/${po.id}`)}
                            />
                        </RowActions>
                    </td>
                ) : null}
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
    const [loadError, setLoadError] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());
    // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
    const requestIdRef = useRef(0);

    const [warehouses, setWarehouses] = useState([]);
    const [khoDaTai, setKhoDaTai] = useState(false);

    const [pagination, setPagination] = useState({ pageNumber: 0, pageSize: SO_DONG_MAC_DINH, totalElements: 0, totalPages: 0 });
    // Ô tìm kiếm chỉ áp dụng khi nhấn Enter (giữ hành vi cũ): searchText là chữ đang gõ, keyword là từ khóa đang lọc
    const [searchText, setSearchText] = useState('');
    const [keyword, setKeyword] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    // Tab trạng thái trên URL ?trangThai= (F5 / quay lại từ chi tiết vẫn đúng tab)
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    const tabTrangThai = YEU_CAU_BAO_GIA_TABS.find((tb) => tb.ma === tab)?.trangThai;

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
    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchRequests = useCallback(async (page = 0, size = SO_DONG_MAC_DINH, { silent = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const response = await apiClient.post(API_FILTER, {
                filters: buildFilterArray({ trangThai: tabTrangThai, tuKhoa: keyword, kho: khoId, ngay: dateRange }),
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
                page, size,
            });
            if (requestId !== requestIdRef.current) return;

            const data = response?.data?.data || {};
            // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
            const trangCuoi = trangCuoiNeuVuot({ trang: page, kichThuoc: size, soDong: data.content?.length ?? 0, tong: data.totalElements });
            if (trangCuoi != null) {
                setPagination((p) => ({ ...p, pageNumber: trangCuoi }));
                return;
            }
            setRequests(data.content || []);
            setPagination({
                pageNumber: data.pageable?.pageNumber ?? 0,
                pageSize: data.pageable?.pageSize ?? size,
                totalElements: data.totalElements || 0,
                totalPages: data.totalPages || 0,
            });
            setLoadError(null);
        } catch (e) {
            if (requestId !== requestIdRef.current) return;
            console.error('Error fetching purchase requests:', e);
            if (silent) throw e;
            // Không giữ dòng + tổng số của lần tải trước (R9). Giữ lỗi gốc để ô lỗi phân biệt 403
            setLoadError(e);
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
            trangThai: YEU_CAU_BAO_GIA_TABS.find((tb) => tb.ma === ma)?.trangThai,
            tuKhoa: keyword,
            kho: khoId,
            ngay: dateRange,
        })),
        `${keyword}|${khoId}|${dateRange.from}|${dateRange.to}`
    );

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: nhà cung cấp trả báo giá qua Cổng NCC
    const capNhat = useTaiLaiDanhSach({
        duLieu: requests,
        taiNgam: () => {
            tabCounts.reload();
            return fetchRequests(pagination.pageNumber, pagination.pageSize, { silent: true });
        },
        bat: !loading,
    });

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
    // Giá mua là giá vốn: chỉ người xem được đơn mua thấy tổng tiền chốt, giá nhà cung cấp báo (máy chủ cũng bỏ giá
    // khỏi API yêu cầu nhập hàng với vai trò khác)
    const xemGia = hasAnyRole(VAI_TRO_XEM_DON_MUA);
    // "Tạo yêu cầu báo giá": trang tạo chặn đúng vai trò máy chủ cho gửi yêu cầu báo giá (nhân viên bán hàng chỉ theo dõi)
    const duocTao = hasAnyRole(VAI_TRO_GUI_YEU_CAU_BAO_GIA);
    const getAcceptedTotal = (req) => {
        if (!xemGia) return null;
        const accepted = (req.donMuaHangs || []).filter(po => laDaChot(po.trangThai));
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
        if (!khoId) return t("Tất cả kho");
        return warehouses.find(w => String(w.id) === khoId)?.tenKho || t("Đang tải...");
    };

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = YEU_CAU_BAO_GIA_TABS.map((tb) => ({
        value: tb.ma,
        label: t(tb.label),
        count: loadError ? null : tabCounts.counts[tb.ma],
    }));
    const emptyTabLabel = t(YEU_CAU_BAO_GIA_TABS.find((tb) => tb.ma === tab)?.label);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                actions={duocTao ? (
                    <Button
                        onClick={() => navigate('/quotation-requests/create')}
                        className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        <Plus className="size-4" /> {t("Tạo yêu cầu báo giá")}
                    </Button>
                ) : null}
            />

            {/* Bấm vào dòng để xem chi tiết yêu cầu, mở rộng để xem các báo giá con */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label={t("Lọc yêu cầu báo giá theo trạng thái")}
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
                            placeholder={t("Nhập mã yêu cầu rồi nhấn Enter")}
                            label={t("Tìm theo mã yêu cầu")}
                            className="sm:w-[300px]"
                        />

                        {/* Kho nhập */}
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    aria-label={t("Lọc theo kho nhập")}
                                    className="h-9 w-full justify-between border-bo-border bg-bo-surface px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[200px]"
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
                                className="z-50 max-h-[300px] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
                            >
                                <DropdownMenuItem onClick={() => changeKho('')} className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                                    {t("Tất cả kho")}
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
                                    onChange={e => handleDateChange(key, e.target.value)}
                                />
                            </label>
                        ))}
                    </ListToolbar>
                }
                footer={
                    !loading && !loadError ? (
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
                {loading ? (
                    <LoadingState label={t("Đang tải danh sách yêu cầu báo giá")} />
                ) : loadError ? (
                    <ErrorState
                        description={t("Không thể tải danh sách yêu cầu báo giá. Vui lòng thử lại.")}
                        error={loadError}
                        onRetry={handleRefresh}
                    />
                ) : requests.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title={t("Không tìm thấy yêu cầu báo giá phù hợp")}
                            description={t("Thử đổi mã yêu cầu, kho hoặc khoảng ngày.")}
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
                            title={t("Không có yêu cầu báo giá nào ở trạng thái \"{{emptyTabLabel}}\"", { emptyTabLabel })}
                            description={t("Chọn tab Tất cả để xem mọi yêu cầu báo giá.")}
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
                            title={t("Chưa có yêu cầu báo giá")}
                            description={duocTao
                                ? t("Tạo yêu cầu báo giá để gửi tới nhà cung cấp.")
                                : t("Yêu cầu báo giá gửi tới nhà cung cấp sẽ hiển thị tại đây.")}
                            action={duocTao ? (
                                <Button
                                    onClick={() => navigate('/quotation-requests/create')}
                                    className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                >
                                    <Plus className="size-4" /> {t("Tạo yêu cầu báo giá")}
                                </Button>
                            ) : null}
                        />
                    )
                ) : (
                    <>
                    {/* Điện thoại: mỗi yêu cầu một thẻ — mã + trạng thái, kho nhập, ngày tạo · người tạo + tổng tiền chốt;
                        chạm thẻ mở chi tiết. Chân thẻ: ngày giao DK + nút "N báo giá" mở danh sách báo giá từng nhà cung cấp
                        ngay dưới thẻ (mỗi báo giá một dòng, chạm mở chi tiết báo giá) thay cho bảng con */}
                    <ul className="divide-y divide-bo-border md:hidden">
                        {requests.map((req) => {
                            const isExpanded = expandedRows.has(req.id);
                            const prCfg = getYeuCauNhapHangStatus(req.trangThai);
                            const poCount = req.donMuaHangs?.length || 0;
                            const acceptedTotal = getAcceptedTotal(req);
                            return (
                                <li key={req.id}>
                                    {/* Nhãn "Đã chuyển thành đơn mua hàng" dài: không đủ chỗ thì thẻ trạng thái xuống dòng dưới mã */}
                                    <Link to={`/quotation-requests/${req.id}`} className="grid grid-cols-1 gap-1 px-4 pb-1 pt-3 active:bg-bo-surface-subtle">
                                        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                            <span className="min-w-0 truncate text-[15px] font-semibold text-bo-primary">#{req.soYeuCauMuaHang}</span>
                                            <StatusBadge quyTrinh="yeuCauNhap" label={prCfg.label} />
                                        </span>
                                        <span className="flex min-w-0 items-center gap-2 text-sm">
                                            <span className="min-w-0 truncate font-semibold text-bo-foreground">{req.khoNhap?.tenKho || '—'}</span>
                                            {req.khoNhap?.maKho ? (
                                                <span className="shrink-0 font-mono text-xs text-bo-muted">{req.khoNhap.maKho}</span>
                                            ) : null}
                                        </span>
                                        <span className="flex items-baseline justify-between gap-3 text-[13px] text-bo-muted">
                                            <span className="min-w-0 truncate">
                                                {formatDate(req.ngayTao)}{req.nguoiTao?.hoTen ? ` · ${req.nguoiTao.hoTen}` : ''}
                                            </span>
                                            {acceptedTotal !== null ? (
                                                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-bo-foreground">{formatCurrency(acceptedTotal)}</span>
                                            ) : null}
                                        </span>
                                    </Link>
                                    <div className="flex min-h-9 items-center justify-between gap-3 px-4 pb-2.5">
                                        <span className="min-w-0 truncate text-[13px] text-bo-muted">{t("Giao DK {{ngayGiao}}", { ngayGiao: formatDate(req.ngayGiaoDuKien) })}</span>
                                        {poCount > 0 ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                aria-expanded={isExpanded}
                                                onClick={(e) => toggleExpand(req.id, e)}
                                                className={cn(
                                                    "h-9 shrink-0 gap-1.5 border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground",
                                                    isExpanded && "border-bo-primary bg-bo-primary-soft text-bo-primary-strong",
                                                )}
                                            >
                                                {t("{{count}} báo giá", { count: poCount })}
                                                {isExpanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
                                            </Button>
                                        ) : (
                                            <span className="shrink-0 text-[13px] text-bo-muted">{t("Chưa có báo giá")}</span>
                                        )}
                                    </div>
                                    {isExpanded && poCount > 0 ? (
                                        <ul
                                            aria-label={t("Báo giá từ nhà cung cấp của yêu cầu {{soYeuCauMuaHang}}", { soYeuCauMuaHang: req.soYeuCauMuaHang })}
                                            className="mx-4 mb-3 divide-y divide-bo-border overflow-hidden rounded-lg border border-bo-border bg-bo-surface-subtle"
                                        >
                                            {req.donMuaHangs.map((po) => {
                                                const nhan = nhanTrangThaiBaoGia(po, getBaoGiaNccStatus(po.trangThai).label);
                                                const daChot = laDaChot(po.trangThai);
                                                const noiDung = (
                                                    <>
                                                        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                                            <span className="min-w-0 truncate text-[13px] font-semibold text-bo-foreground">{po.soDonMua}</span>
                                                            <StatusBadge quyTrinh="yeuCauBaoGia" label={nhan} />
                                                        </span>
                                                        <span className="flex items-baseline justify-between gap-3 text-sm">
                                                            <span className="min-w-0 truncate text-bo-foreground">{po.nhaCungCap?.tenNhaCungCap || '—'}</span>
                                                            {xemGia ? (
                                                                <span className="shrink-0 font-semibold tabular-nums text-bo-foreground">
                                                                    {po.tongTien != null ? formatCurrency(po.tongTien) : '—'}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                        <span className="flex items-baseline justify-between gap-3 text-xs text-bo-muted">
                                                            <span className="min-w-0 truncate">
                                                                {t("Gửi {{ngayGui}} · Hạn {{ngayHan}}", { ngayGui: formatDate(ngayGuiYeuCau(po)), ngayHan: formatDate(po.ngayGiaoDuKien) })}
                                                            </span>
                                                            {daChot ? (
                                                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-bo-success">{t("Đã chốt")}</span>
                                                            ) : null}
                                                        </span>
                                                    </>
                                                );
                                                // Chi tiết báo giá chỉ mở được với vai trò xem đơn mua: vai trò khác thấy dòng, không chạm mở
                                                return (
                                                    <li key={po.id}>
                                                        {xemGia ? (
                                                            <Link to={`/quotation/${po.id}`} className="grid grid-cols-1 gap-0.5 px-3 py-2.5 active:bg-bo-surface">
                                                                {noiDung}
                                                            </Link>
                                                        ) : (
                                                            <div className="grid grid-cols-1 gap-0.5 px-3 py-2.5">{noiDung}</div>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                    {/* Bảng: khung giãn hết màn, thân bảng tự cuộn, tiêu đề cột đứng yên.
                        Dòng mở rộng chứa bảng báo giá con nằm gọn trong một ô của bảng chính.
                        Máy tính bảng dọc (cảm ứng): bỏ cột Ngày tạo, Ngày giao DK, Người tạo, Thao tác — đưa thành dòng phụ
                        dưới mã yêu cầu / kho nhập / trạng thái (Xem chi tiết = chạm dòng) — để bảng vừa khung, không vuốt ngang */}
                    <table className="w-full min-w-[1040px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3" />
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Mã yêu cầu")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Kho nhập")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Ngày tạo")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Ngày giao DK")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Trạng thái")}</th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Người tạo")}</th>
                                {xemGia ? (
                                    <th className="h-10 px-3 text-right tabular-nums whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Tổng tiền chốt")}</th>
                                ) : null}
                                <th className="h-10 w-24 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Thao tác")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {requests.map((req) => {
                                const isExpanded = expandedRows.has(req.id);
                                const prCfg = getYeuCauNhapHangStatus(req.trangThai);
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
                                                    <span className="hidden text-xs text-bo-muted cam-ung:max-lg:block">{formatDate(req.ngayTao)}</span>
                                                    {poCount > 0 && (
                                                        <span className="text-xs text-bo-muted">{t("{{count}} báo giá", { count: poCount })}</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-3 py-3">
                                                <p className="text-[13px] font-semibold text-bo-foreground">{req.khoNhap?.tenKho}</p>
                                                <p className="mt-0.5 font-mono text-[11px] text-bo-muted">{req.khoNhap?.maKho}</p>
                                                {req.nguoiTao?.hoTen ? (
                                                    <p className="mt-0.5 hidden text-xs text-bo-muted cam-ung:max-lg:block">{req.nguoiTao.hoTen}</p>
                                                ) : null}
                                            </td>

                                            <td className="px-3 py-3 cam-ung:max-lg:hidden">
                                                <div className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-bo-muted">
                                                    <Calendar className="size-3.5 shrink-0" /> {formatDate(req.ngayTao)}
                                                </div>
                                            </td>

                                            <td className="px-3 py-3 cam-ung:max-lg:hidden">
                                                <div className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-bo-muted">
                                                    <Calendar className="size-3.5 shrink-0" /> {formatDate(req.ngayGiaoDuKien)}
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-3 py-3">
                                                <StatusBadge quyTrinh="yeuCauNhap" label={prCfg.label} />
                                                <p className="mt-1 hidden text-xs text-bo-muted cam-ung:max-lg:block">{t("Giao DK {{ngayGiao}}", { ngayGiao: formatDate(req.ngayGiaoDuKien) })}</p>
                                            </td>

                                            <td className="px-3 py-3 text-[13px] font-medium text-bo-muted cam-ung:max-lg:hidden">
                                                {req.nguoiTao?.hoTen || '-'}
                                            </td>

                                            {xemGia ? (
                                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                                    {acceptedTotal !== null ? (
                                                        <span className="font-semibold text-bo-foreground">{formatCurrency(acceptedTotal)}</span>
                                                    ) : (
                                                        <span className="text-bo-muted">—</span>
                                                    )}
                                                </td>
                                            ) : null}

                                            <td className="px-3 py-3 cam-ung:max-lg:hidden">
                                                <RowActions>
                                                    <RowActionButton
                                                        icon={Eye}
                                                        label={t("Xem chi tiết yêu cầu")}
                                                        onClick={() => navigate(`/quotation-requests/${req.id}`)}
                                                    />
                                                </RowActions>
                                            </td>
                                        </tr>

                                        {/* ── Expanded PO sub-table (Đơn báo giá con) ── */}
                                        {isExpanded && hasPos && (
                                            <tr>
                                                <td colSpan={xemGia ? 9 : 8} className="border-b border-bo-border p-0">
                                                    {/* w-0 min-w-full: bảng con không đẩy rộng bảng chính — rộng bằng ô, thiếu chỗ thì tự cuộn ngang trong khung của nó */}
                                                    <div className="w-0 min-w-full bg-bo-surface-subtle pb-5 pt-3">
                                                        <div className="px-3">
                                                            <TableShell
                                                                title={t("Danh sách báo giá từ NCC thuộc yêu cầu này")}
                                                                className="shadow-none"
                                                            >
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b border-bo-border bg-bo-surface">
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">{t("Mã báo giá")}</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">{t("Nhà cung cấp")}</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Ngày gửi")}</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Hạn chót")}</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted">{t("Trạng thái")}</th>
                                                                            <th className="h-9 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Người tạo (NCC)")}</th>
                                                                            {xemGia ? (
                                                                                <>
                                                                                    <th className="h-9 whitespace-nowrap px-3 text-right tabular-nums text-[10px] font-semibold uppercase tracking-wide text-bo-muted">{t("Giá NCC báo")}</th>
                                                                                    <th className="h-9 w-28 whitespace-nowrap px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">{t("Thao tác")}</th>
                                                                                </>
                                                                            ) : null}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        <DonMuaHangRows
                                                                            donMuaHangs={req.donMuaHangs}
                                                                            navigate={navigate}
                                                                            xemGia={xemGia}
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
                    </>
                )}
            </TableShell>
        </PageContainer>
    );
}
