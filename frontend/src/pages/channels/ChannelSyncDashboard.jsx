import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Activity, Download, Eye, History, Loader2, RefreshCcw,
    RotateCcw, SearchX, Send, Settings2, Store,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import FilterSelect from "@/components/shared/FilterSelect";
import ListToolbar from "@/components/shared/ListToolbar";
import MetricStrip from "@/components/shared/MetricStrip";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelBadge from "@/components/channel/ChannelBadge";
import ConnectionStatusBadge from "@/components/channel/ConnectionStatusBadge";
import SyncStatusBadge from "@/components/channel/SyncStatusBadge";
import SyncLogDetailSheet from "@/components/channel/SyncLogDetailSheet";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { kenhBanHangService, isChannelSyncMock } from "@/services/kenhBanHangService";
import {
    LOG_SOURCE, LOG_STATUS_TABS, LOG_TYPE, LOG_TYPE_OPTIONS, getErrorHint,
} from "@/constants/channel";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/dateTime";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { cn } from "@/lib/utils";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";

const TH_CLASS = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
// Trạng thái sự kiện nằm ở tab (URL ?trangThai=), không còn trong bộ lọc
const DEFAULT_FILTERS = { keyword: "", ketNoiKenhId: "", loai: "", page: 0, size: SO_DONG_MAC_DINH };
const REFRESH_MS = 30_000;
const inputClass =
    "h-10 w-full rounded-lg border border-bo-border bg-white px-3 text-sm text-bo-foreground outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15";

// Tab trạng thái sự kiện (bố cục A+G)
const TAB_MAS = LOG_STATUS_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const TAB_LOI = "loi";
const TONE_TAB = { [TAB_LOI]: "danger" };
const trangThaiCuaTab = (ma) => LOG_STATUS_TABS.find((tab) => tab.ma === ma)?.trangThai ?? undefined;


/** "2026-10-10T09:00" cho input datetime-local, theo giờ máy */
function toLocalInput(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const formatDateTimeLocal = (value) => formatDateTime(value, { withYear: false });

// Icon xoay cho nút "Thử lại" của dòng đang chạy (RowActionButton nhận một icon)
const IconDangChay = ({ className, ...props }) => <Loader2 {...props} className={cn(className, "animate-spin")} />;

export default function ChannelSyncDashboard() {
    const navigate = useNavigate();
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    // Dòng chú ý chỉ cho quản trị viên (cùng nguồn vai trò với RequireRole của route)
    const [laQuanTriVien] = useState(() => hasAnyRole([ROLES.QUAN_TRI_VIEN]));
    const [overview, setOverview] = useState(null);
    const [overviewError, setOverviewError] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [logs, setLogs] = useState([]);
    // Bộ lọc của các dòng đang hiện: đổi tab / trang thì hiện khung tải thay vì dòng của tab cũ
    const [logsKey, setLogsKey] = useState(null);
    const [total, setTotal] = useState(0);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [logsError, setLogsError] = useState(false);
    const [detailId, setDetailId] = useState(null);
    const [action, setAction] = useState(null); // `${type}:${id}`
    const [confirmAll, setConfirmAll] = useState(false);
    const [layDonTarget, setLayDonTarget] = useState(null);
    const [layDonRange, setLayDonRange] = useState({ tu: "", den: "" });
    const actionRef = useRef(false);
    const requestIdRef = useRef(0);
    const logTableRef = useRef(null);

    const trangThai = trangThaiCuaTab(tab);
    const tuKhoa = filters.keyword.trim();
    const filterKey = `${tab}|${tuKhoa}|${filters.ketNoiKenhId}|${filters.loai}|${filters.page}|${filters.size}`;

    const fetchOverview = useCallback(async () => {
        try {
            setOverview(await kenhBanHangService.tongQuan());
            setOverviewError(false);
        } catch {
            setOverviewError(true);
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        // Đổi tab / bộ lọc liên tiếp: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        setLoadingLogs(true);
        setLogsError(false);
        try {
            const res = await kenhBanHangService.filterNhatKy({
                page: filters.page,
                size: filters.size,
                ketNoiKenhId: filters.ketNoiKenhId ? Number(filters.ketNoiKenhId) : undefined,
                loai: filters.loai || undefined,
                trangThai,
                search: tuKhoa || undefined,
            });
            if (requestId !== requestIdRef.current) return;
            setLogs(res?.content ?? []);
            setTotal(res?.totalElements ?? 0);
            setLogsKey(filterKey);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setLogsError(true);
            setLogs([]);
            setTotal(0);
            setLogsKey(null);
            toast.error(getApiErrorMessage(error, "Không tải được nhật ký đồng bộ"));
        } finally {
            if (requestId === requestIdRef.current) setLoadingLogs(false);
        }
    }, [filters.page, filters.size, filters.ketNoiKenhId, filters.loai, trangThai, tuKhoa, filterKey]);

    useEffect(() => {
        queueMicrotask(() => fetchOverview());
    }, [fetchOverview]);

    useEffect(() => {
        queueMicrotask(() => fetchLogs());
    }, [fetchLogs]);

    // Tự làm mới tổng quan mỗi 30 giây khi tab đang hiện; nhật ký chỉ tải khi đổi bộ lọc
    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") fetchOverview();
        }, REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [fetchOverview]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setFilters((prev) => (prev.keyword === searchText ? prev : { ...prev, keyword: searchText, page: 0 }));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchText]);

    // ── Số trên tab: cùng gian hàng + loại + từ khóa, chỉ thay trạng thái (R1) ──
    const demNhatKy = async (maTrangThai, { ketNoiKenhId, loai, search } = {}) => {
        const res = await kenhBanHangService.filterNhatKy({
            page: 0,
            size: 1,
            ketNoiKenhId: ketNoiKenhId ? Number(ketNoiKenhId) : undefined,
            loai: loai || undefined,
            trangThai: maTrangThai,
            search: search || undefined,
        });
        return res?.totalElements ?? 0;
    };
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        (ma) => demNhatKy(trangThaiCuaTab(ma), { ketNoiKenhId: filters.ketNoiKenhId, loai: filters.loai, search: tuKhoa }),
        `${tuKhoa}|${filters.ketNoiKenhId}|${filters.loai}`
    );

    // ── Dòng chú ý: sự kiện lỗi, cùng nguồn với tab Lỗi nhưng bỏ các bộ lọc khác (R4) ──
    const suKienLoi = useDemTheoTrangThai(
        [TAB_LOI],
        () => demNhatKy(trangThaiCuaTab(TAB_LOI)),
        "",
        { enabled: laQuanTriVien }
    );

    const reloadCounts = () => {
        tabCounts.reload();
        suKienLoi.reload();
    };

    const runAction = async (key, fn) => {
        if (actionRef.current) return;
        actionRef.current = true;
        setAction(key);
        try {
            await fn();
            fetchOverview();
            fetchLogs();
            reloadCounts();
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không thực hiện được thao tác"));
        } finally {
            actionRef.current = false;
            setAction(null);
        }
    };

    const pushStock = (ketNoi) => runAction(`day:${ketNoi.id}`, async () => {
        const res = await kenhBanHangService.dayTon(ketNoi.id);
        toast.success(`${ketNoi.tenHienThi}: đã đưa ${res?.soDong ?? 0} SKU vào hàng đẩy tồn`);
    });

    const openLayDon = (ketNoi) => {
        const den = new Date();
        const tu = new Date(den.getTime() - 24 * 3_600_000);
        setLayDonRange({ tu: toLocalInput(tu), den: toLocalInput(den) });
        setLayDonTarget(ketNoi);
    };

    const submitLayDon = () => {
        const ketNoi = layDonTarget;
        if (!ketNoi) return;
        if (!layDonRange.tu || !layDonRange.den || new Date(layDonRange.tu) >= new Date(layDonRange.den)) {
            toast.error("Khoảng thời gian không hợp lệ: thời điểm bắt đầu phải trước thời điểm kết thúc.");
            return;
        }
        runAction(`don:${ketNoi.id}`, async () => {
            const res = await kenhBanHangService.layDon(ketNoi.id, {
                tu: new Date(layDonRange.tu).toISOString(),
                den: new Date(layDonRange.den).toISOString(),
            });
            toast.success(`${ketNoi.tenHienThi}: nhận ${res?.soSuKien ?? 0} sự kiện đơn hàng để xử lý`);
            setLayDonTarget(null);
        });
    };

    const syncAll = () => runAction("all", async () => {
        const res = await kenhBanHangService.dongBoTatCa();
        toast.success(`Đã chạy đợt đồng bộ cho ${res?.soKetNoi ?? 0} gian hàng`);
        setConfirmAll(false);
    });

    const retryLog = (log) => runAction(`log:${log.id}`, async () => {
        await kenhBanHangService.thuLai(log.id);
        toast.success("Đã đưa vào hàng đợi thử lại");
    });

    // Đổi tab: ghi lên URL và về trang đầu
    const changeTab = (value) => {
        setTab(value);
        setFilters((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    };

    // "Xóa lọc": bỏ từ khóa, gian hàng, loại; giữ tab đang chọn
    const clearFilters = () => {
        setSearchText("");
        setFilters((prev) => ({ ...DEFAULT_FILTERS, size: prev.size }));
    };

    // Nút của dòng chú ý: mở tab Lỗi, bỏ các bộ lọc khác để số dòng khớp số trên dòng chú ý
    // (bảng nhật ký nằm dưới khu gian hàng nên cuộn tới bảng)
    const showLoi = () => {
        clearFilters();
        changeTab(TAB_LOI);
        logTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const handleRetryLogs = () => {
        fetchLogs();
        reloadCounts();
    };

    const ketNois = overview?.ketNois ?? [];
    const connectionOptions = [
        { value: "", label: "Tất cả gian hàng" },
        ...ketNois.map((kn) => ({ value: String(kn.id), label: kn.tenHienThi })),
    ];
    const hasFilter = Boolean(searchText.trim() || tuKhoa || filters.ketNoiKenhId || filters.loai);
    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = LOG_STATUS_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        tone: TONE_TAB[t.ma],
        count: logsError ? null : tabCounts.counts[t.ma],
    }));
    const soLoi = laQuanTriVien && tab !== TAB_LOI ? suKienLoi.counts[TAB_LOI] : null;
    const emptyTabLabel = LOG_STATUS_TABS.find((t) => t.ma === tab)?.label;
    // Đang tải cho bộ lọc khác (đổi tab / trang / bộ lọc) thì không hiện dòng cũ; tải lại sau thao tác thì giữ bảng
    const loadingOther = loadingLogs && (logs.length === 0 || logsKey !== filterKey);

    // 4 chỉ số theo dõi (SRS 9.1.1), gộp thành một dải
    const metrics = [
        {
            label: "Kênh đang kết nối",
            value: overview ? overview.kenhDangKetNoi : "—",
            hint: overview ? `${overview.tongKetNoi} gian hàng` : overviewError ? "Không tải được" : undefined,
        },
        {
            label: "Sự kiện trong nhật ký",
            value: overview ? overview.suKienTrongNhatKy : "—",
            hint: "24 giờ qua",
        },
        {
            label: "Sự kiện cần xử lý",
            value: overview ? overview.suKienCanXuLy : "—",
            tone: overview?.suKienCanXuLy ? "danger" : undefined,
            hint: "Sự kiện ở trạng thái Lỗi",
        },
        {
            label: "Chu kỳ đồng bộ tồn",
            value: overview?.chuKyDongBoTonPhut != null ? `${overview.chuKyDongBoTonPhut} phút` : "—",
            hint: overview?.chuKyLayDonPhut != null ? `Lấy đơn mỗi ${overview.chuKyLayDonPhut} phút` : undefined,
        },
    ];

    return (
        <PageContainer className="space-y-4">
            <MockModeNotice show={isChannelSyncMock} reason="hệ thống chưa hỗ trợ nhật ký đồng bộ" />

            {/* ══ CHỈ SỐ ══ */}
            <MetricStrip label="Chỉ số đồng bộ" items={metrics} loading={!overview && !overviewError} />

            <AttentionBar
                count={soLoi}
                tone="danger"
                actionLabel="Xem sự kiện lỗi"
                onAction={showLoi}
            >
                <strong className="font-semibold">{soLoi?.toLocaleString("vi-VN")} sự kiện lỗi</strong> cần xử lý.
            </AttentionBar>

            {/* ══ GIAN HÀNG ══ */}
            <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                <div className="flex flex-col gap-3 border-b border-bo-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div>
                        <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">Trạng thái gian hàng</h2>
                        <p className="mt-0.5 text-xs leading-5 text-bo-muted sm:text-sm">Tự làm mới mỗi 30 giây khi đang mở trang.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => navigate("/channels")}
                            className="h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <Settings2 className="size-4" />
                            Cấu hình tích hợp
                        </Button>
                        <Button
                            onClick={() => setConfirmAll(true)}
                            disabled={Boolean(action)}
                            className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {action === "all" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                            Chạy đợt đồng bộ
                        </Button>
                    </div>
                </div>
                <div className="p-4 sm:p-5">
                    {!overview && !overviewError ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-bo-muted">
                            <Loader2 className="size-4 animate-spin" /> Đang tải trạng thái gian hàng
                        </div>
                    ) : overviewError && !overview ? (
                        <ErrorState className="min-h-40" onRetry={fetchOverview} />
                    ) : ketNois.length === 0 ? (
                        <EmptyState
                            className="min-h-40"
                            icon={Store}
                            title="Chưa có gian hàng nào"
                            description="Kết nối gian hàng ở trang Kết nối gian hàng để bắt đầu đồng bộ."
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                            {ketNois.map((kn) => {
                                const active = kn.trangThai === "dang_hoat_dong";
                                return (
                                    <article key={kn.id} className="rounded-lg border border-bo-border bg-white p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <ChannelBadge maKenh={kn.maKenh} />
                                                    <ConnectionStatusBadge trangThai={kn.trangThai} />
                                                </div>
                                                <p className="mt-2 truncate text-sm font-semibold text-bo-foreground">{kn.tenHienThi}</p>
                                            </div>
                                        </div>
                                        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <dt className="text-xs text-bo-muted">Đẩy tồn gần nhất</dt>
                                                <dd className="font-semibold text-bo-foreground">{formatDateTimeLocal(kn.lanDayTonCuoi) || "Chưa có"}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-bo-muted">Lấy đơn gần nhất</dt>
                                                <dd className="font-semibold text-bo-foreground">{formatDateTimeLocal(kn.lanLayDonCuoi) || "Chưa có"}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-bo-muted">Lỗi đang mở</dt>
                                                <dd className={`font-semibold ${kn.soLoi ? "text-bo-danger" : "text-bo-foreground"}`}>{kn.soLoi ?? 0}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-bo-muted">SKU chờ đẩy</dt>
                                                <dd className="font-semibold text-bo-foreground">{kn.soChoDay ?? 0}</dd>
                                            </div>
                                        </dl>
                                        <div className="mt-4 flex flex-wrap gap-2 border-t border-bo-border pt-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!active || Boolean(action)}
                                                onClick={() => pushStock(kn)}
                                                className="h-8 gap-1.5 border-bo-primary/30 bg-bo-primary-soft px-3 text-xs font-semibold text-bo-primary hover:bg-bo-primary-soft/70 hover:text-bo-primary disabled:opacity-50"
                                            >
                                                {action === `day:${kn.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                                                Đẩy tồn ngay
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!active || Boolean(action)}
                                                onClick={() => openLayDon(kn)}
                                                className="h-8 gap-1.5 border-bo-border bg-white px-3 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                            >
                                                <Download className="size-3.5" />
                                                Lấy đơn
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setFilters((prev) => ({ ...prev, ketNoiKenhId: String(kn.id), page: 0 }))}
                                                className="h-8 gap-1.5 border-bo-border bg-white px-3 text-xs text-bo-foreground hover:bg-bo-surface-subtle"
                                            >
                                                <History className="size-3.5" />
                                                Xem nhật ký
                                            </Button>
                                        </div>
                                        {!active ? (
                                            <p className="mt-2 text-xs text-bo-muted">Gian hàng không hoạt động nên không đồng bộ thủ công được.</p>
                                        ) : null}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ══ BẢNG NHẬT KÝ ══ — màn theo dõi nhiều khu nên giữ tên khu (không trùng tên trang) */}
            <div ref={logTableRef} className="scroll-mt-4">
                <TableShell
                    title="Nhật ký đồng bộ"
                    description="Nhấn vào dòng để xem dữ liệu chi tiết (đã che thông tin nhạy cảm)"
                    toolbar={
                        <ListToolbar
                            tabs={
                                <StatusTabs
                                    label="Lọc nhật ký theo trạng thái sự kiện"
                                    tabs={statusTabs}
                                    value={tab}
                                    onChange={changeTab}
                                />
                            }
                            hasFilter={hasFilter}
                            onClear={clearFilters}
                        >
                            <SearchInput
                                placeholder="Tìm SKU, mã đơn, thông điệp..."
                                label="Tìm trong nhật ký"
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                onClear={() => setSearchText("")}
                                className="sm:w-[300px]"
                            />
                            <FilterSelect
                                label="Gian hàng"
                                value={filters.ketNoiKenhId}
                                options={connectionOptions}
                                onChange={(ketNoiKenhId) => setFilters((prev) => ({ ...prev, ketNoiKenhId, page: 0 }))}
                                className="sm:w-[180px]"
                                align="end"
                            />
                            <FilterSelect
                                label="Loại"
                                value={filters.loai}
                                options={LOG_TYPE_OPTIONS}
                                onChange={(loai) => setFilters((prev) => ({ ...prev, loai, page: 0 }))}
                                className="sm:w-[160px]"
                                align="end"
                            />
                        </ListToolbar>
                    }
                    footer={
                        !loadingOther && !logsError && logs.length > 0 ? (
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
                        <LoadingState className="min-h-64" label="Đang tải nhật ký" />
                    ) : logsError ? (
                        <ErrorState
                            description="Không tải được nhật ký đồng bộ. Vui lòng thử lại."
                            onRetry={handleRetryLogs}
                        />
                    ) : logs.length === 0 ? (
                        hasFilter ? (
                            <EmptyState
                                icon={SearchX}
                                title="Không tìm thấy sự kiện phù hợp"
                                description="Thử đổi từ khóa, gian hàng hoặc loại sự kiện."
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
                                icon={Activity}
                                title={`Không có sự kiện nào ở trạng thái "${emptyTabLabel}"`}
                                description="Chọn tab Tất cả để xem mọi sự kiện đồng bộ."
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
                                icon={Activity}
                                title="Chưa có sự kiện đồng bộ"
                                description="Sự kiện đẩy tồn, nhận đơn, token sẽ hiện ở đây."
                            />
                        )
                    ) : (
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead>
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    <th className={`${TH_CLASS} text-left`}>Thời gian</th>
                                    <th className={`${TH_CLASS} text-left`}>Gian hàng</th>
                                    <th className={`${TH_CLASS} text-left`}>Loại / Nguồn</th>
                                    <th className={`${TH_CLASS} text-left`}>Tham chiếu</th>
                                    <th className={`${TH_CLASS} text-left`}>Thông điệp</th>
                                    <th className={`${TH_CLASS} text-center`}>Trạng thái</th>
                                    <th className={`${TH_CLASS} text-center`}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                                {logs.map((log) => {
                                    const hint = getErrorHint(log.maLoi);
                                    return (
                                        <tr
                                            key={log.id}
                                            onClick={() => setDetailId(log.id)}
                                            className="cursor-pointer align-top transition-colors hover:bg-bo-surface-subtle"
                                        >
                                            <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">{formatDateTimeLocal(log.ngayTao)}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <ChannelBadge maKenh={log.maKenh} className="w-fit" />
                                                    <span className="text-xs text-bo-muted">{log.tenHienThi}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="font-semibold text-bo-foreground">{LOG_TYPE[log.loai] ?? log.loai}</span>
                                                <span className="block text-xs text-bo-muted">{LOG_SOURCE[log.nguon] ?? log.nguon}</span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="font-mono text-xs font-semibold text-bo-foreground">{log.maThamChieu || "—"}</span>
                                            </td>
                                            <td className="max-w-[340px] px-3 py-3">
                                                <p className="line-clamp-2 text-sm text-bo-foreground">{log.thongDiep || "—"}</p>
                                                {log.maLoi ? (
                                                    <p className="mt-0.5 text-xs text-bo-muted">
                                                        <span className="font-mono text-bo-danger">{log.maLoi}</span>
                                                        {hint ? ` · ${hint}` : ""}
                                                    </p>
                                                ) : null}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <SyncStatusBadge trangThai={log.trangThai} />
                                            </td>
                                            <td className="px-3 py-3">
                                                <RowActions>
                                                    {log.coTheThuLai ? (
                                                        <RowActionButton
                                                            icon={action === `log:${log.id}` ? IconDangChay : RotateCcw}
                                                            label={action === `log:${log.id}` ? "Đang thử lại..." : "Thử lại"}
                                                            disabled={Boolean(action)}
                                                            onClick={() => retryLog(log)}
                                                        />
                                                    ) : (
                                                        <span className="size-8 shrink-0" aria-hidden="true" />
                                                    )}
                                                    <RowActionButton
                                                        icon={Eye}
                                                        label="Xem chi tiết"
                                                        onClick={() => setDetailId(log.id)}
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
            </div>

            <SyncLogDetailSheet
                logId={detailId}
                open={detailId !== null}
                onOpenChange={(open) => !open && setDetailId(null)}
                onRetried={() => {
                    fetchLogs();
                    fetchOverview();
                    reloadCounts();
                }}
            />

            <ConfirmModal
                isOpen={confirmAll}
                onClose={() => action !== "all" && setConfirmAll(false)}
                onConfirm={syncAll}
                variant="info"
                title="Chạy đợt đồng bộ"
                description="Đẩy tồn và lấy đơn ngay cho mọi gian hàng đang hoạt động, không chờ chu kỳ định kỳ."
                confirmText="Chạy ngay"
                cancelText="Quay lại"
                isLoading={action === "all"}
            />

            <Dialog open={Boolean(layDonTarget)} onOpenChange={(open) => !open && !action && setLayDonTarget(null)}>
                <DialogContent className="rounded-xl border-bo-border sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-bo-foreground">Lấy đơn thủ công</DialogTitle>
                        <DialogDescription className="text-slate-600">
                            {layDonTarget?.tenHienThi}: quét lại đơn cập nhật trong khoảng thời gian bên dưới. Đơn đã nhập sẽ không bị nhập trùng.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="lay-don-tu" className="mb-1.5 block text-sm font-medium text-bo-foreground">Từ</label>
                            <input
                                id="lay-don-tu"
                                type="datetime-local"
                                value={layDonRange.tu}
                                onChange={(event) => setLayDonRange((prev) => ({ ...prev, tu: event.target.value }))}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="lay-don-den" className="mb-1.5 block text-sm font-medium text-bo-foreground">Đến</label>
                            <input
                                id="lay-don-den"
                                type="datetime-local"
                                value={layDonRange.den}
                                onChange={(event) => setLayDonRange((prev) => ({ ...prev, den: event.target.value }))}
                                className={inputClass}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={Boolean(action)}
                            onClick={() => setLayDonTarget(null)}
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            Hủy
                        </Button>
                        <Button
                            type="button"
                            disabled={Boolean(action)}
                            onClick={submitLayDon}
                            className="min-w-[130px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {action?.startsWith("don:") ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                            Lấy đơn
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
