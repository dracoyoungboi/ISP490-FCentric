import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft, Download, Link2, Loader2, SearchX, Send, Settings2, Wand2,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import ConnectionStatusBadge from "@/components/channel/ConnectionStatusBadge";
import SkuCombobox from "@/components/channel/SkuCombobox";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { kenhBanHangService, isChannelSyncMock } from "@/services/kenhBanHangService";
import { LINK_STATUS, LINK_STATUS_TABS } from "@/constants/channel";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatNumber } from "@/utils/formatters";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { ROLES, hasAnyRole } from "@/utils/roles";

const TH_CLASS = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const switchClass = "data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 [&>span]:bg-white";
const DEFAULT_FILTERS = { keyword: "", page: 0, size: SO_DONG_MAC_DINH };

// Tab trạng thái liên kết (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const TAB_MAS = LINK_STATUS_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const TAB_CHUA_LIEN_KET = "chua-lien-ket";
const TONE_TAB = { [TAB_CHUA_LIEN_KET]: "warning" };
const trangThaiCuaTab = (ma) => LINK_STATUS_TABS.find((tab) => tab.ma === ma)?.trangThai ?? undefined;

export default function ChannelMappingsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    // Dòng chú ý chỉ cho quản trị viên (cùng nguồn vai trò với RequireRole của route)
    const [laQuanTriVien] = useState(() => hasAnyRole([ROLES.QUAN_TRI_VIEN]));

    const [ketNoi, setKetNoi] = useState(null);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [rows, setRows] = useState([]);
    // Bộ lọc của các dòng đang hiện: đổi tab / trang thì hiện khung tải thay vì dòng của tab cũ
    const [rowsKey, setRowsKey] = useState(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [rowSaving, setRowSaving] = useState({});
    const [rowErrors, setRowErrors] = useState({});
    const [toolbarAction, setToolbarAction] = useState(null);
    const toolbarRef = useRef(false);
    const requestIdRef = useRef(0);

    const trangThaiLienKet = trangThaiCuaTab(tab);
    const tuKhoa = filters.keyword.trim();
    const filterKey = `${id}|${tab}|${tuKhoa}|${filters.page}|${filters.size}`;

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setFilters((prev) => (prev.keyword === searchText ? prev : { ...prev, keyword: searchText, page: 0 }));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchText]);

    const fetchKetNoi = useCallback(async () => {
        try {
            setKetNoi(await kenhBanHangService.getKetNoi(id));
        } catch {
            // lỗi kết nối đã hiện ở bảng
        }
    }, [id]);

    const fetchRows = useCallback(async () => {
        // Đổi tab / từ khóa liên tiếp: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setLoadError(false);
        try {
            const res = await kenhBanHangService.filterLienKet(id, {
                page: filters.page,
                size: filters.size,
                trangThaiLienKet,
                search: tuKhoa || undefined,
            });
            if (requestId !== requestIdRef.current) return;
            setRows(res?.content ?? []);
            setTotal(res?.totalElements ?? 0);
            setRowsKey(filterKey);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setLoadError(true);
            setRows([]);
            setTotal(0);
            setRowsKey(null);
            toast.error(getApiErrorMessage(error, "Không tải được danh sách liên kết"));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [id, filters.page, filters.size, trangThaiLienKet, tuKhoa, filterKey]);

    useEffect(() => {
        queueMicrotask(() => fetchKetNoi());
    }, [fetchKetNoi]);

    useEffect(() => {
        queueMicrotask(() => fetchRows());
    }, [fetchRows]);

    // ── Số trên tab: cùng gian hàng + từ khóa, chỉ thay trạng thái liên kết (R1) ──
    const demLienKet = async (trangThai, search) => {
        const res = await kenhBanHangService.filterLienKet(id, { page: 0, size: 1, trangThaiLienKet: trangThai, search });
        return res?.totalElements ?? 0;
    };
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        (ma) => demLienKet(trangThaiCuaTab(ma), tuKhoa || undefined),
        `${id}|${tuKhoa}`
    );

    // ── Dòng chú ý: SKU chưa liên kết của gian hàng, bỏ qua từ khóa (R4) ──
    const chuaLienKet = useDemTheoTrangThai(
        [TAB_CHUA_LIEN_KET],
        () => demLienKet(trangThaiCuaTab(TAB_CHUA_LIEN_KET)),
        String(id),
        { enabled: laQuanTriVien }
    );

    const reloadCounts = () => {
        tabCounts.reload();
        chuaLienKet.reload();
    };

    const saveRow = async (row, patch) => {
        if (rowSaving[row.id]) return;
        setRowSaving((prev) => ({ ...prev, [row.id]: true }));
        setRowErrors((prev) => ({ ...prev, [row.id]: undefined }));
        try {
            const nextBienThe = "bienTheSanPhamId" in patch ? patch.bienTheSanPhamId : row.bienTheSanPhamId;
            const dto = await kenhBanHangService.capNhatLienKet(row.id, {
                bienTheSanPhamId: nextBienThe ?? null,
                choPhepDongBo: "choPhepDongBo" in patch ? patch.choPhepDongBo : (nextBienThe ? row.choPhepDongBo || !row.bienTheSanPhamId : false),
            });
            setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...dto } : item)));
            fetchKetNoi();
            // Ghép / bỏ ghép đổi trạng thái liên kết: đếm lại số trên tab (R8)
            reloadCounts();
        } catch (error) {
            setRowErrors((prev) => ({ ...prev, [row.id]: getApiErrorMessage(error, "Không lưu được liên kết") }));
        } finally {
            setRowSaving((prev) => ({ ...prev, [row.id]: false }));
        }
    };

    const runToolbar = async (name) => {
        if (toolbarRef.current) return;
        toolbarRef.current = true;
        setToolbarAction(name);
        try {
            if (name === "tai") {
                const res = await kenhBanHangService.taiSanPham(id);
                toast.success(`Đã tải ${res?.soSku ?? 0} SKU (${res?.soMoi ?? 0} mới, ${res?.soCapNhat ?? 0} cập nhật)`);
            } else if (name === "ghep") {
                const res = await kenhBanHangService.tuDongLienKet(id);
                toast.success(`Đã ghép ${res?.soDaGhep ?? 0} SKU · ${res?.soKhongKhop ?? 0} không khớp · ${res?.soNhieuKhop ?? 0} khớp nhiều`);
            } else if (name === "day") {
                const res = await kenhBanHangService.dayTon(id);
                toast.success(`Đã đưa ${res?.soDong ?? 0} SKU vào hàng đẩy tồn`);
            }
            fetchRows();
            fetchKetNoi();
            reloadCounts();
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không thực hiện được thao tác"));
        } finally {
            toolbarRef.current = false;
            setToolbarAction(null);
        }
    };

    // Đổi tab: ghi lên URL và về trang đầu
    const changeTab = (value) => {
        setTab(value);
        setFilters((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    };

    // "Xóa lọc": bỏ từ khóa, giữ tab đang chọn
    const clearFilters = () => {
        setSearchText("");
        setFilters((prev) => (prev.keyword === "" && prev.page === 0 ? prev : { ...prev, keyword: "", page: 0 }));
    };

    // Nút của dòng chú ý: mở tab Chưa liên kết, bỏ từ khóa để số dòng khớp số trên dòng chú ý
    const showChuaLienKet = () => {
        clearFilters();
        changeTab(TAB_CHUA_LIEN_KET);
    };

    const handleRetry = () => {
        fetchRows();
        reloadCounts();
    };

    const hasFilter = Boolean(searchText.trim() || tuKhoa);
    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = LINK_STATUS_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        tone: TONE_TAB[t.ma],
        count: loadError ? null : tabCounts.counts[t.ma],
    }));
    const pendingCount = laQuanTriVien && tab !== TAB_CHUA_LIEN_KET ? chuaLienKet.counts[TAB_CHUA_LIEN_KET] : null;
    const emptyTabLabel = LINK_STATUS_TABS.find((t) => t.ma === tab)?.label;
    // Đang tải cho bộ lọc khác (đổi tab / trang / từ khóa) thì không hiện dòng cũ; tải lại sau thao tác thì giữ bảng
    const loadingOther = loading && (rows.length === 0 || rowsKey !== filterKey);

    return (
        <PageContainer fill className="space-y-4">
            <MockModeNotice show={isChannelSyncMock} reason="hệ thống chưa hỗ trợ liên kết sản phẩm" />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <button
                    type="button"
                    onClick={() => navigate("/channels")}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại Kết nối gian hàng
                </button>
                <Button
                    variant="outline"
                    onClick={() => navigate(`/channels/${id}/setup`)}
                    className="h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                >
                    <Settings2 className="size-4" />
                    Cấu hình
                </Button>
            </div>

            {/* ── Thông tin gian hàng + thao tác đồng bộ (cùng khung với trang Thiết lập) ── */}
            {ketNoi ? (
                <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                            <ChannelLogo maKenh={ketNoi.maKenh} />
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-bo-foreground">
                                    {ketNoi.tenHienThi}
                                    <ConnectionStatusBadge trangThai={ketNoi.trangThai} />
                                </p>
                                <p className="mt-0.5 truncate font-mono text-xs text-bo-muted">{ketNoi.tenMienShop || ketNoi.shopIdSan}</p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <ToolbarButton icon={Download} busy={toolbarAction === "tai"} disabled={Boolean(toolbarAction)} onClick={() => runToolbar("tai")}>
                                Tải lại sản phẩm
                            </ToolbarButton>
                            <ToolbarButton icon={Wand2} busy={toolbarAction === "ghep"} disabled={Boolean(toolbarAction)} onClick={() => runToolbar("ghep")}>
                                Tự động liên kết
                            </ToolbarButton>
                            <Button
                                onClick={() => runToolbar("day")}
                                disabled={Boolean(toolbarAction) || ketNoi.trangThai !== "dang_hoat_dong"}
                                className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                {toolbarAction === "day" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                Đẩy tồn ngay
                            </Button>
                        </div>
                    </div>
                    {/* Quy tắc liên kết (trước nằm ở mô tả khung bảng) */}
                    <p className="border-t border-bo-border px-4 py-2.5 text-xs leading-5 text-bo-muted sm:px-6">
                        Mỗi biến thể chỉ liên kết với 1 SKU sàn trong một gian hàng. Đổi liên kết thì lần đẩy sau sẽ đặt lại số tồn trên sàn.
                    </p>
                </section>
            ) : null}

            <AttentionBar
                count={pendingCount}
                actionLabel="Xem SKU chưa liên kết"
                onAction={showChuaLienKet}
            >
                <strong className="font-semibold">{pendingCount?.toLocaleString("vi-VN")} SKU</strong> chưa liên kết.
            </AttentionBar>

            {/* ══ BẢNG LIÊN KẾT ══ */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc SKU theo trạng thái liên kết"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasFilter}
                        onClear={clearFilters}
                    >
                        <SearchInput
                            placeholder="Tìm SKU sàn, tên sản phẩm..."
                            label="Tìm liên kết"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            onClear={() => setSearchText("")}
                            className="sm:w-[300px]"
                        />
                    </ListToolbar>
                }
                footer={
                    !loadingOther && !loadError && rows.length > 0 ? (
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
                            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                            onSizeChange={(size) => setFilters((prev) => ({ ...prev, size, page: 0 }))}
                        />
                    ) : null
                }
            >
                {loadingOther ? (
                    <LoadingState className="min-h-64" label="Đang tải liên kết sản phẩm" />
                ) : loadError ? (
                    <ErrorState
                        description="Không tải được danh sách liên kết. Vui lòng thử lại."
                        onRetry={handleRetry}
                    />
                ) : rows.length === 0 ? (
                    hasFilter ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy SKU phù hợp"
                            description="Thử đổi từ khóa tìm kiếm."
                            action={
                                <Button variant="outline" onClick={clearFilters} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={Link2}
                            title={`Không có SKU nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi SKU của gian hàng."
                            action={
                                <Button variant="outline" onClick={() => changeTab(TAB_MAC_DINH)} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Link2}
                            title="Chưa có SKU nào từ sàn"
                            description="Bấm Tải lại sản phẩm để lấy danh sách SKU từ Shopify."
                        />
                    )
                ) : (
                    <TooltipProvider>
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    <th className={`${TH_CLASS} text-left`}>Sản phẩm trên sàn</th>
                                    <th className={`${TH_CLASS} w-[320px] text-left`}>Biến thể FCentric</th>
                                    <th className={`${TH_CLASS} text-right tabular-nums`}>Khả dụng</th>
                                    <th className={`${TH_CLASS} text-right tabular-nums`}>Sẽ đẩy</th>
                                    <th className={`${TH_CLASS} text-right tabular-nums`}>Đã đẩy</th>
                                    <th className={`${TH_CLASS} text-center`}>Đồng bộ</th>
                                    <th className={`${TH_CLASS} text-center`}>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                                {rows.map((row) => {
                                    const status = LINK_STATUS[row.trangThaiLienKet] ?? { label: row.trangThaiLienKet, tone: "neutral" };
                                    const linked = Boolean(row.bienTheSanPhamId);
                                    const saving = Boolean(rowSaving[row.id]);
                                    return (
                                        <tr key={row.id} className="align-top transition-colors hover:bg-bo-surface-subtle">
                                            <td className="px-3 py-3">
                                                <p className="font-semibold text-bo-foreground">{row.tenSanPhamSan || "—"}</p>
                                                <p className="text-xs text-bo-muted">{row.tenBienTheSan}</p>
                                                {row.skuSan?.trim() ? (
                                                    <span className="mt-1 inline-block rounded-md bg-bo-surface-subtle px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                                                        {row.skuSan}
                                                    </span>
                                                ) : (
                                                    <span className="mt-1 inline-block text-xs italic text-bo-warning">SKU trống trên sàn</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <SkuCombobox
                                                    value={linked ? { id: row.bienTheSanPhamId, maSku: row.maSku, tenBienThe: row.tenBienThe } : null}
                                                    saving={saving}
                                                    onChange={(option) => saveRow(row, { bienTheSanPhamId: option?.id ?? null })}
                                                />
                                                {rowErrors[row.id] ? <p className="mt-1 text-xs text-bo-danger">{rowErrors[row.id]}</p> : null}
                                            </td>
                                            <td className="px-3 py-3 text-right tabular-nums">
                                                {row.khaDung !== null && row.khaDung !== undefined ? (
                                                    <span className="font-semibold text-bo-foreground">{formatNumber(row.khaDung)}</span>
                                                ) : (
                                                    <span className="text-bo-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right tabular-nums">
                                                {row.soDay !== null && row.soDay !== undefined ? (
                                                    <span className="font-semibold text-bo-primary">{formatNumber(row.soDay)}</span>
                                                ) : (
                                                    <span className="text-bo-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right tabular-nums">
                                                {row.soLuongDaDay !== null && row.soLuongDaDay !== undefined ? (
                                                    <span className="font-semibold text-bo-foreground">{formatNumber(row.soLuongDaDay)}</span>
                                                ) : linked ? (
                                                    <span className="text-xs text-bo-muted">Chưa rõ, sẽ đẩy lại</span>
                                                ) : (
                                                    <span className="text-bo-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <Switch
                                                    checked={Boolean(row.choPhepDongBo)}
                                                    disabled={!linked || saving}
                                                    aria-label={`Đồng bộ ${row.skuSan || row.tenBienTheSan}`}
                                                    onCheckedChange={(value) => saveRow(row, { choPhepDongBo: value })}
                                                    className={switchClass}
                                                />
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {row.chiTietLoi ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="inline-flex cursor-help">
                                                                <StatusBadge label={status.label} tone={status.tone} />
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">{row.chiTietLoi}</TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <StatusBadge label={status.label} tone={status.tone} />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </TooltipProvider>
                )}
            </TableShell>
        </PageContainer>
    );
}

function ToolbarButton({ icon, busy, disabled, onClick, children }) {
    return (
        <Button
            variant="outline"
            onClick={onClick}
            disabled={disabled}
            className="h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
        >
            {busy ? <Loader2 className="size-4 animate-spin" /> : createElement(icon, { className: "size-4" })}
            {children}
        </Button>
    );
}
