// src/pages/lich-su-giao-dich-kho/LichSuGiaoDichKhoList.jsx
import { createElement, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
    Loader2, History, ArrowDownToLine, ArrowUpFromLine,
    ArrowLeftRight, SlidersHorizontal, Warehouse, Eye,
    CalendarDays, User2, FileText, Hash, Package, SearchX,
} from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { getLichSuGiaoDichKho, getChiTietLichSu } from "@/services/lichSuGiaoDichKhoService";
import { getMineKhoList } from "@/services/khoService";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { formatDateTime, formatNumber } from "@/utils/formatters";

// ── Constants ─────────────────────────────────────────────────────────────
// "chuyen_kho" giữ để hiện nhãn cho dữ liệu cũ (nếu có); backend hiện chỉ ghi 3 loại còn lại.
// Loại giao dịch là phân loại, không phải trạng thái: hiện chữ thường kèm icon xám; chiều nhập / xuất đọc ở dấu +/− của cột Số lượng.
const LOAI_GIAO_DICH_CONFIG = {
    nhap_kho:   { label: "Nhập kho",   icon: ArrowDownToLine },
    xuat_kho:   { label: "Xuất kho",   icon: ArrowUpFromLine },
    chuyen_kho: { label: "Chuyển kho", icon: ArrowLeftRight },
    dieu_chinh: { label: "Điều chỉnh", icon: SlidersHorizontal },
};

// Tab theo LOẠI giao dịch (bố cục A+G) — mã tab trên URL ?loai=; `loai` là giá trị loaiGiaoDich
const LOAI_TABS = [
    { value: "tat-ca",     label: "Tất cả",                             loai: null         },
    { value: "nhap-kho",   label: LOAI_GIAO_DICH_CONFIG.nhap_kho.label,   loai: "nhap_kho"   },
    { value: "xuat-kho",   label: LOAI_GIAO_DICH_CONFIG.xuat_kho.label,   loai: "xuat_kho"   },
    { value: "dieu-chinh", label: LOAI_GIAO_DICH_CONFIG.dieu_chinh.label, loai: "dieu_chinh" },
];
const LOAI_TAB_VALUES = LOAI_TABS.map((t) => t.value);
const TAB_MAC_DINH = "tat-ca";

// Dòng thuộc tab nào: dùng chung cho bảng và số trên tab (R1)
const matchLoai = (item, tab) => {
    const loai = LOAI_TABS.find((t) => t.value === tab)?.loai;
    return !loai || item.loaiGiaoDich === loai;
};

const matchSearch = (item, search) => {
    const q = search.toLowerCase().trim();
    return !q ||
        item.tenSanPham?.toLowerCase().includes(q) ||
        item.maSku?.toLowerCase().includes(q) ||
        item.maLo?.toLowerCase().includes(q) ||
        item.tenKho?.toLowerCase().includes(q) ||
        item.nguoiDungTen?.toLowerCase().includes(q);
};

const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// Tiêu đề cột của bảng (căn lề theo kiểu dữ liệu: số căn phải, thao tác căn giữa)
const TABLE_COLUMNS = [
    { label: "STT",             className: "w-14 text-left" },
    { label: "Ngày giao dịch",  className: "text-left" },
    { label: "Loại",            className: "text-left" },
    { label: "Sản phẩm",        className: "text-left" },
    { label: "SKU",             className: "text-left" },
    { label: "Lô hàng",         className: "text-left" },
    { label: "Kho",             className: "text-left" },
    { label: "Số lượng",        className: "text-right tabular-nums" },
    { label: "Người thực hiện", className: "text-left" },
    { label: "Thao tác",        className: "text-center" },
];

// ── Loại giao dịch ────────────────────────────────────────────────────────
function LoaiGiaoDich({ loai }) {
    const cfg = LOAI_GIAO_DICH_CONFIG[loai] ?? { label: loai || "—", icon: null };
    const Icon = cfg.icon;
    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700">
            {Icon ? <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" /> : null}
            {cfg.label}
        </span>
    );
}

// ── Field helper ──────────────────────────────────────────────────────────
function LightField({ icon: Icon, label, value, mono = false }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-bo-muted">{label}</span>
            <div className="flex items-center gap-1.5">
                {createElement(Icon, { className: "size-3.5 shrink-0 text-bo-muted" })}
                <span className={`text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>
                    {value || "—"}
                </span>
            </div>
        </div>
    );
}

// ── Detail Modal ──────────────────────────────────────────────────────────
function DetailModal({ open, onClose, item, loading }) {
    const soLuong = Number(item?.soLuong ?? 0);
    const isXuatKho = item?.loaiGiaoDich === "xuat_kho";
    const displaySoLuong = isXuatKho ? -Math.abs(soLuong) : soLuong;
    const soLuongColor  = displaySoLuong > 0 ? "text-bo-success" : displaySoLuong < 0 ? "text-bo-danger" : "text-slate-600";
    const soLuongBg     = displaySoLuong > 0 ? "bg-bo-success-soft" : displaySoLuong < 0 ? "bg-bo-danger-soft" : "bg-bo-surface-subtle";
    const soLuongPrefix = displaySoLuong > 0 ? "+" : displaySoLuong < 0 ? "-" : "";

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg overflow-hidden rounded-lg border border-bo-border bg-bo-surface p-0 shadow-lg [&>button]:text-slate-500 [&>button]:hover:text-slate-700">

                {/* ── Header ── */}
                <div className="flex items-center justify-between gap-3 border-b border-bo-border bg-bo-surface-subtle px-5 pb-4 pt-5">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-bo-primary-soft">
                            <History className="size-4 text-bo-primary" />
                        </span>
                        Chi tiết giao dịch {item ? (
                            <span className="font-mono text-bo-primary">#{item.id}</span>
                        ) : ""}
                    </DialogTitle>
                    {item && <LoaiGiaoDich loai={item.loaiGiaoDich} />}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 bg-bo-surface py-14">
                        <Loader2 className="size-5 animate-spin text-bo-primary" />
                        <span className="text-sm text-bo-muted">Đang tải...</span>
                    </div>
                ) : item ? (
                    <div className="space-y-4 bg-bo-surface px-5 py-4">

                        {/* Ngày giao dịch */}
                        <div className="flex items-center gap-2 rounded-lg border border-bo-border bg-bo-surface-subtle px-4 py-2.5 text-sm text-slate-700">
                            <CalendarDays className="size-4 shrink-0 text-bo-muted" />
                            <span className="font-medium">{formatDateTime(item.ngayGiaoDich)}</span>
                        </div>

                        {/* Grid fields */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-bo-border bg-bo-surface-subtle px-4 py-4">
                            <LightField icon={Package}      label="Sản phẩm"        value={item.tenSanPham} />
                            <LightField icon={Hash}         label="SKU"             value={item.maSku} mono />
                            <LightField icon={FileText}     label="Lô hàng"         value={item.maLo} mono />
                            <LightField icon={Warehouse}    label="Kho"             value={item.tenKho} />
                            <LightField icon={User2}        label="Người thực hiện" value={item.nguoiDungTen} />
                            <LightField icon={FileText}     label="Loại tham chiếu" value={item.loaiThamChieu} />
                            {item.idThamChieu && (
                                <LightField icon={Hash}     label="ID tham chiếu"   value={`#${item.idThamChieu}`} mono />
                            )}
                            {item.tenKhoChuyenDen && (
                                <LightField icon={ArrowLeftRight} label="Kho chuyển đến" value={item.tenKhoChuyenDen} />
                            )}
                        </div>

                        {/* Số lượng 3 ô */}
                        <div className="grid grid-cols-3 divide-x divide-bo-border overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                            {[
                                { label: "TRƯỚC",    value: item.soLuongTruoc ?? 0, color: "text-slate-700", bg: "bg-white",    prefix: "" },
                                { label: "THAY ĐỔI", value: Math.abs(displaySoLuong), color: soLuongColor,     bg: soLuongBg,     prefix: soLuongPrefix },
                                { label: "SAU",      value: item.soLuongSau ?? 0,   color: "text-slate-700", bg: "bg-white",    prefix: "" },
                            ].map(({ label, value, color, bg, prefix }) => (
                                <div key={label} className={`flex flex-col items-center py-4 ${bg}`}>
                                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-bo-muted">{label}</span>
                                    <span className={`text-xl font-bold ${color}`}>{prefix}{value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Ghi chú */}
                        {item.ghiChu && (
                            <div className="rounded-lg border border-bo-warning/20 bg-bo-warning-soft px-4 py-3">
                                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-bo-warning">Ghi chú</p>
                                <p className="text-sm text-slate-700">{item.ghiChu}</p>
                            </div>
                        )}

                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function LichSuGiaoDichKhoList() {
    const [data,           setData]           = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [loadError,      setLoadError]      = useState(false);
    const [search,         setSearch]         = useState("");
    const [pageNumber,     setPageNumber]      = useState(0);
    const [pageSize,       setPageSize]       = useState(SO_DONG_MAC_DINH);
    const [selectedId,     setSelectedId]     = useState(null);
    const [chiTiet,        setChiTiet]        = useState(null);
    const [loadingDetail,  setLoadingDetail]  = useState(false);
    const [myWarehouseIds, setMyWarehouseIds] = useState([]);
    const requestIdRef = useRef(0);

    // Tab loại giao dịch trên URL (?loai=nhap-kho | xuat-kho | dieu-chinh)
    const [filterLoai, setFilterLoai] = useTabTrenUrl(LOAI_TAB_VALUES, TAB_MAC_DINH, { ten: "loai" });

    // Phân quyền — giống PhieuChuyenKhoDetail
    const role     = localStorage.getItem("role");
    const isAdmin  = role === "quan_tri_vien";

    // ── Fetch ──────────────────────────────────────────────────────────
    // Tải lịch sử + danh sách kho mình có quyền (cùng pattern PhieuChuyenKhoDetail) cùng lúc,
    // để người không phải quản trị viên không thấy bảng rỗng tạm thời khi kho chưa tải xong.
    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng và trang đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchData = useCallback(async ({ silent = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const [list, listKho] = await Promise.all([
                getLichSuGiaoDichKho(),
                getMineKhoList().catch((err) => {
                    // Quản trị viên xem mọi kho nên không cần danh sách này (giữ như cũ: chỉ ghi log)
                    if (!isAdmin) throw err;
                    console.error("Lỗi khi tải danh sách kho phân quyền:", err);
                    return [];
                }),
            ]);
            if (requestId !== requestIdRef.current) return;
            setData(list ?? []);
            setMyWarehouseIds((listKho ?? []).map((k) => k.id));
            setLoadError(false);
            if (!silent) setPageNumber(0);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            if (silent) throw error;
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setData([]);
            setLoadError(true);
            toast.error("Không thể tải lịch sử giao dịch kho");
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [isAdmin]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: sổ ghi liên tục từ POS, nhập, xuất, chuyển kho
    const capNhat = useTaiLaiDanhSach({
        duLieu: data,
        taiNgam: () => fetchData({ silent: true }),
        bat: !loading,
    });

    // ── Filter ─────────────────────────────────────────────────────────
    // Phân quyền lọc danh sách: admin thấy tất, còn lại chỉ thấy kho mình có quyền
    const visibleData = useMemo(() => {
        if (isAdmin) return data;
        return data.filter((item) => myWarehouseIds.includes(item.khoId));
    }, [data, myWarehouseIds, isAdmin]);

    // Lọc mọi thứ trừ loại (để đếm số trên tab), rồi lọc loại cho bảng
    const searched = useMemo(
        () => visibleData.filter((item) => matchSearch(item, search)),
        [visibleData, search]
    );
    const filtered = useMemo(
        () => searched.filter((item) => matchLoai(item, filterLoai)),
        [searched, filterLoai]
    );

    // Số trên tab = số dòng thấy khi bấm tab, theo từ khóa đang tìm (R1); đang tải / lỗi thì không hiện (R9)
    const loaiTabs = useMemo(
        () => LOAI_TABS.map((tab) => ({
            value: tab.value,
            label: tab.label,
            count: loading || loadError ? null : searched.filter((item) => matchLoai(item, tab.value)).length,
        })),
        [searched, loading, loadError]
    );

    // ── Pagination ─────────────────────────────────────────────────────
    const totalElements = filtered.length;
    const totalPages    = Math.max(1, Math.ceil(totalElements / pageSize));
    const safePage      = Math.min(pageNumber, totalPages - 1);
    const pageItems     = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
    const handlePageChange = (p) => { if (p >= 0 && p < totalPages) setPageNumber(p); };

    // Đổi tab / từ khóa: về trang đầu
    const changeTab = (value) => { setFilterLoai(value); setPageNumber(0); };
    const changeSearch = (value) => { setSearch(value); setPageNumber(0); };
    // "Xóa lọc" chỉ xóa từ khóa, giữ tab loại đang chọn
    const handleClearSearch = () => changeSearch("");

    // ── Detail ─────────────────────────────────────────────────────────
    const handleViewDetail = async (item) => {
        // Phân quyền: admin luôn xem được; còn lại phải thuộc kho đó
        const hasPermission = isAdmin || myWarehouseIds.includes(item.khoId);
        if (!hasPermission) {
            toast.error("Bạn không có quyền xem chi tiết giao dịch này");
            return;
        }
        setSelectedId(item.id);
        setChiTiet(null);
        setLoadingDetail(true);
        try {
            const detail = await getChiTietLichSu(item.id);
            setChiTiet(detail);
        } catch {
            toast.error("Không thể tải chi tiết");
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleCloseModal = () => { setSelectedId(null); setChiTiet(null); };

    const currentLoaiLabel = LOAI_TABS.find((t) => t.value === filterLoai)?.label;

    return (
        <PageContainer fill className="space-y-4">

            <DetailModal open={!!selectedId} onClose={handleCloseModal} item={chiTiet} loading={loadingDetail} />

            {/* Ghi chú phạm vi (R3): mọi vai trò không phải quản trị viên đều lọc theo kho phụ trách (visibleData) */}
            <ListPageHeader scope={isAdmin ? null : "Kho bạn phụ trách"} />

            {/* ── Table: tab loại giao dịch + tìm kiếm cùng một hàng ── */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc giao dịch theo loại"
                                tabs={loaiTabs}
                                value={filterLoai}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={Boolean(search.trim())}
                        onClear={handleClearSearch}
                    >
                        <SearchInput
                            label="Tìm kiếm"
                            placeholder="Tìm theo sản phẩm, SKU, lô, kho, người thực hiện..."
                            value={search}
                            onChange={(e) => changeSearch(e.target.value)}
                            onClear={handleClearSearch}
                            className="sm:w-[380px]"
                        />
                    </ListToolbar>
                }
                footer={!loading && !loadError ? (
                    <TablePagination
                        page={safePage}
                        size={pageSize}
                        total={totalElements}
                        onPageChange={handlePageChange}
                        onSizeChange={(size) => { setPageSize(size); setPageNumber(0); }}
                        capNhat={capNhat}
                    />
                ) : null}
            >
                {loading ? (
                    <LoadingState rows={6} label="Đang tải lịch sử giao dịch kho" />
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải lịch sử giao dịch kho. Vui lòng thử lại."
                        onRetry={() => fetchData()}
                    />
                ) : pageItems.length === 0 ? (
                    search.trim() ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy giao dịch phù hợp"
                            description="Thử đổi từ khóa tìm kiếm."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={handleClearSearch}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : filterLoai !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={History}
                            title={`Không có giao dịch loại "${currentLoaiLabel}"`}
                            description="Chọn tab Tất cả để xem mọi giao dịch kho."
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
                            icon={History}
                            title="Chưa có giao dịch kho"
                            description="Các lần nhập kho, xuất kho và điều chỉnh tồn sẽ được ghi lại tại đây."
                        />
                    )
                ) : (
                    <table className="w-full min-w-[1080px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                {TABLE_COLUMNS.map((col) => (
                                    <th key={col.label} className={`${TH_CLASS} ${col.className}`}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {pageItems.map((item, index) => {
                                const soLuong = Number(item.soLuong);
                                const isXuatKho = item.loaiGiaoDich === "xuat_kho";
                                const displaySoLuong = isXuatKho ? -Math.abs(soLuong) : soLuong;
                                const soLuongColor =
                                    displaySoLuong > 0 ? "text-bo-success" :
                                    displaySoLuong < 0 ? "text-bo-danger" :
                                    "text-slate-700";
                                const soLuongPrefix = displaySoLuong > 0 ? "+" : displaySoLuong < 0 ? "-" : "";

                                return (
                                    <tr key={item.id} className="transition-colors hover:bg-bo-surface-subtle">

                                        <td className="px-4 py-3.5 align-middle text-xs text-bo-muted">
                                            {safePage * pageSize + index + 1}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                                            <span className="text-xs text-bo-muted">{formatDateTime(item.ngayGiaoDich)}</span>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle">
                                            <LoaiGiaoDich loai={item.loaiGiaoDich} />
                                        </td>

                                        <td className="max-w-[180px] px-4 py-3.5 align-middle">
                                            <span className="font-semibold leading-snug text-bo-foreground">
                                                {item.tenSanPham || "—"}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle">
                                            <span className="whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
                                                {item.maSku || "—"}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle">
                                            <span className="font-mono text-xs text-bo-muted">
                                                {item.maLo || "—"}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle">
                                            <span className="font-medium text-bo-foreground">{item.tenKho || "—"}</span>
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle tabular-nums">
                                            <span className={`text-base font-bold ${soLuongColor}`}>
                                                {soLuongPrefix}{formatNumber(Math.abs(displaySoLuong))}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle">
                                            <span className="font-medium text-bo-foreground">{item.nguoiDungTen || "—"}</span>
                                        </td>

                                        <td className="px-4 py-3.5 text-center align-middle">
                                            <RowActions>
                                                <RowActionButton
                                                    icon={Eye}
                                                    label="Xem chi tiết"
                                                    onClick={() => handleViewDetail(item)}
                                                />
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
