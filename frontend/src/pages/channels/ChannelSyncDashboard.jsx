import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Activity, AlertOctagon, Clock3, Download, Eye, History, Loader2, RefreshCcw,
    RotateCcw, Send, Settings2, Store,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import FilterBar from "@/components/shared/FilterBar";
import FilterPanel from "@/components/shared/FilterPanel";
import FilterSelect from "@/components/shared/FilterSelect";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import KpiCard from "@/components/shared/KpiCard";
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
    LOG_SOURCE, LOG_STATUS_OPTIONS, LOG_TYPE, LOG_TYPE_OPTIONS, getErrorHint,
} from "@/constants/channel";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/dateTime";

const TH_CLASS = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const DEFAULT_FILTERS = { keyword: "", ketNoiKenhId: "", loai: "", trangThai: "", page: 0, size: 10 };
const REFRESH_MS = 30_000;
const inputClass =
    "h-10 w-full rounded-lg border border-bo-border bg-white px-3 text-sm text-bo-foreground outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15";


/** "2026-10-10T09:00" cho input datetime-local, theo giờ máy */
function toLocalInput(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const formatDateTimeLocal = (value) => formatDateTime(value, { withYear: false });

export default function ChannelSyncDashboard() {
    const navigate = useNavigate();
    const [overview, setOverview] = useState(null);
    const [overviewError, setOverviewError] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logsError, setLogsError] = useState(false);
    const [detailId, setDetailId] = useState(null);
    const [action, setAction] = useState(null); // `${type}:${id}`
    const [confirmAll, setConfirmAll] = useState(false);
    const [layDonTarget, setLayDonTarget] = useState(null);
    const [layDonRange, setLayDonRange] = useState({ tu: "", den: "" });
    const actionRef = useRef(false);

    const fetchOverview = useCallback(async () => {
        try {
            setOverview(await kenhBanHangService.tongQuan());
            setOverviewError(false);
        } catch {
            setOverviewError(true);
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        setLoadingLogs(true);
        setLogsError(false);
        try {
            const res = await kenhBanHangService.filterNhatKy({
                page: filters.page,
                size: filters.size,
                ketNoiKenhId: filters.ketNoiKenhId ? Number(filters.ketNoiKenhId) : undefined,
                loai: filters.loai || undefined,
                trangThai: filters.trangThai || undefined,
                search: filters.keyword.trim() || undefined,
            });
            setLogs(res?.content ?? []);
            setTotal(res?.totalElements ?? 0);
        } catch (error) {
            setLogsError(true);
            toast.error(getApiErrorMessage(error, "Không tải được nhật ký đồng bộ"));
        } finally {
            setLoadingLogs(false);
        }
    }, [filters]);

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

    const runAction = async (key, fn) => {
        if (actionRef.current) return;
        actionRef.current = true;
        setAction(key);
        try {
            await fn();
            fetchOverview();
            fetchLogs();
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

    const ketNois = overview?.ketNois ?? [];
    const connectionOptions = [
        { value: "", label: "Tất cả gian hàng" },
        ...ketNois.map((kn) => ({ value: String(kn.id), label: kn.tenHienThi })),
    ];
    const hasFilter = Boolean(filters.keyword || filters.ketNoiKenhId || filters.loai || filters.trangThai);

    return (
        <PageContainer className="space-y-5">
            <MockModeNotice show={isChannelSyncMock} reason="backend chưa có API nhật ký đồng bộ" />

            {/* ══ KPI ══ */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                    icon={<Store className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Kênh đang kết nối"
                    value={overview ? overview.kenhDangKetNoi : "—"}
                    sub={overview ? `${overview.tongKetNoi} gian hàng` : overviewError ? "Không tải được" : " "}
                />
                <KpiCard
                    icon={<History className="size-5" />}
                    iconClass="bg-indigo-50 text-indigo-600"
                    label="Sự kiện trong nhật ký"
                    value={overview ? overview.suKienTrongNhatKy : "—"}
                    sub="24 giờ qua"
                />
                <KpiCard
                    onClick={() => setFilters((prev) => ({ ...prev, trangThai: "LOI", page: 0 }))}
                    title="Lọc nhật ký lỗi"
                    icon={<AlertOctagon className="size-5" />}
                    iconClass={overview?.suKienCanXuLy ? "bg-bo-danger-soft text-bo-danger" : "bg-slate-100 text-slate-500"}
                    label="Sự kiện cần xử lý"
                    value={overview ? overview.suKienCanXuLy : "—"}
                    valueClass={overview?.suKienCanXuLy ? "text-bo-danger" : undefined}
                    sub="Bấm để lọc nhật ký lỗi"
                />
                <KpiCard
                    icon={<Clock3 className="size-5" />}
                    iconClass="bg-bo-success-soft text-bo-success"
                    label="Chu kỳ đồng bộ tồn"
                    value={overview ? `${overview.chuKyDongBoTonPhut} phút` : "—"}
                    sub={overview ? `Lấy đơn mỗi ${overview.chuKyLayDonPhut} phút` : " "}
                />
            </section>

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

            {/* ══ BỘ LỌC NHẬT KÝ ══ */}
            <FilterPanel title="Nhật ký đồng bộ">
                <FilterBar
                    primary={
                        <SearchInput
                            placeholder="Tìm SKU, mã đơn, thông điệp..."
                            label="Tìm trong nhật ký"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            onClear={() => setSearchText("")}
                        />
                    }
                    filters={
                        <>
                            <FilterSelect
                                label="Gian hàng"
                                value={filters.ketNoiKenhId}
                                options={connectionOptions}
                                onChange={(ketNoiKenhId) => setFilters((prev) => ({ ...prev, ketNoiKenhId, page: 0 }))}
                                className="sm:w-[180px]"
                            />
                            <FilterSelect
                                label="Loại"
                                value={filters.loai}
                                options={LOG_TYPE_OPTIONS}
                                onChange={(loai) => setFilters((prev) => ({ ...prev, loai, page: 0 }))}
                                className="sm:w-[160px]"
                            />
                            <FilterSelect
                                label="Trạng thái"
                                value={filters.trangThai}
                                options={LOG_STATUS_OPTIONS}
                                onChange={(trangThai) => setFilters((prev) => ({ ...prev, trangThai, page: 0 }))}
                                className="sm:w-[170px]"
                            />
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearchText("");
                                    setFilters(DEFAULT_FILTERS);
                                }}
                                disabled={loadingLogs}
                                className="h-9 gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                <RefreshCcw className="size-4" />
                                Đặt lại
                            </Button>
                        </>
                    }
                />
            </FilterPanel>

            {/* ══ BẢNG NHẬT KÝ ══ */}
            <TableShell
                title="Sự kiện đồng bộ"
                description="Nhấn vào dòng để xem dữ liệu chi tiết (đã che thông tin nhạy cảm)"
                footer={
                    !loadingLogs && !logsError && logs.length > 0 ? (
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
                {loadingLogs && logs.length === 0 ? (
                    <LoadingState className="min-h-64" label="Đang tải nhật ký" />
                ) : logsError ? (
                    <ErrorState onRetry={fetchLogs} />
                ) : logs.length === 0 ? (
                    <EmptyState
                        icon={Activity}
                        title={hasFilter ? "Không có sự kiện phù hợp" : "Chưa có sự kiện đồng bộ"}
                        description={hasFilter ? "Thử đổi bộ lọc hoặc từ khóa." : "Sự kiện đẩy tồn, nhận đơn, token sẽ hiện ở đây."}
                    />
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
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {log.coTheThuLai ? (
                                                    <button
                                                        type="button"
                                                        disabled={Boolean(action)}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            retryLog(log);
                                                        }}
                                                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary disabled:opacity-50"
                                                        title="Thử lại"
                                                    >
                                                        {action === `log:${log.id}` ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                                                    </button>
                                                ) : (
                                                    <span className="size-8" aria-hidden="true" />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setDetailId(log.id);
                                                    }}
                                                    className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>

            <SyncLogDetailSheet
                logId={detailId}
                open={detailId !== null}
                onOpenChange={(open) => !open && setDetailId(null)}
                onRetried={() => {
                    fetchLogs();
                    fetchOverview();
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
