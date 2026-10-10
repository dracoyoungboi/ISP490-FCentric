import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    AlertCircle, ArrowLeft, CheckCircle2, Download, Link2, Loader2, PackageSearch,
    RefreshCcw, Send, Settings2, Unlink, Wand2,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import FilterBar from "@/components/shared/FilterBar";
import FilterPanel from "@/components/shared/FilterPanel";
import FilterSelect from "@/components/shared/FilterSelect";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import KpiCard from "@/components/shared/KpiCard";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import ConnectionStatusBadge from "@/components/channel/ConnectionStatusBadge";
import SkuCombobox from "@/components/channel/SkuCombobox";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { kenhBanHangService, isChannelSyncMock } from "@/services/kenhBanHangService";
import { LINK_STATUS, LINK_STATUS_OPTIONS } from "@/constants/channel";
import { getApiErrorMessage } from "@/utils/apiError";

const TH_CLASS = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const switchClass = "data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 [&>span]:bg-white";
const DEFAULT_FILTERS = { keyword: "", trangThaiLienKet: "", page: 0, size: 10 };

export default function ChannelMappingsPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [ketNoi, setKetNoi] = useState(null);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [rowSaving, setRowSaving] = useState({});
    const [rowErrors, setRowErrors] = useState({});
    const [toolbarAction, setToolbarAction] = useState(null);
    const toolbarRef = useRef(false);

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
        setLoading(true);
        setLoadError(false);
        try {
            const res = await kenhBanHangService.filterLienKet(id, {
                page: filters.page,
                size: filters.size,
                trangThaiLienKet: filters.trangThaiLienKet || undefined,
                search: filters.keyword.trim() || undefined,
            });
            setRows(res?.content ?? []);
            setTotal(res?.totalElements ?? 0);
        } catch (error) {
            setLoadError(true);
            toast.error(getApiErrorMessage(error, "Không tải được danh sách liên kết"));
        } finally {
            setLoading(false);
        }
    }, [id, filters]);

    useEffect(() => {
        queueMicrotask(() => fetchKetNoi());
    }, [fetchKetNoi]);

    useEffect(() => {
        queueMicrotask(() => fetchRows());
    }, [fetchRows]);

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
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không thực hiện được thao tác"));
        } finally {
            toolbarRef.current = false;
            setToolbarAction(null);
        }
    };

    const handleReset = () => {
        setSearchText("");
        setFilters(DEFAULT_FILTERS);
    };

    const hasFilter = Boolean(filters.keyword || filters.trangThaiLienKet);
    const soLoi = ketNoi ? Math.max(0, (ketNoi.soLienKet ?? 0) - (ketNoi.soLienKetDangBat ?? 0) - (ketNoi.soChuaLienKet ?? 0)) : 0;

    return (
        <PageContainer className="space-y-5">
            <MockModeNotice show={isChannelSyncMock} reason="backend chưa có API liên kết sản phẩm" />

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
                </section>
            ) : null}

            {/* ══ STATS ══ */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard icon={<PackageSearch className="size-5" />} iconClass="bg-bo-primary-soft text-bo-primary" label="SKU trên sàn" value={ketNoi?.soLienKet ?? "—"} />
                <KpiCard icon={<CheckCircle2 className="size-5" />} iconClass="bg-bo-success-soft text-bo-success" label="Đang đồng bộ" value={ketNoi?.soLienKetDangBat ?? "—"} />
                <KpiCard icon={<Unlink className="size-5" />} iconClass="bg-bo-warning-soft text-bo-warning" label="Chưa liên kết" value={ketNoi?.soChuaLienKet ?? "—"} />
                <KpiCard icon={<AlertCircle className="size-5" />} iconClass="bg-bo-danger-soft text-bo-danger" label="Lỗi / tắt đồng bộ" value={ketNoi ? soLoi : "—"} />
            </section>

            {/* ══ BỘ LỌC ══ */}
            <FilterPanel>
                <FilterBar
                    primary={
                        <SearchInput
                            placeholder="Tìm SKU sàn, tên sản phẩm..."
                            label="Tìm liên kết"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            onClear={() => setSearchText("")}
                        />
                    }
                    filters={
                        <>
                            <FilterSelect
                                label="Trạng thái liên kết"
                                value={filters.trangThaiLienKet}
                                options={LINK_STATUS_OPTIONS}
                                onChange={(trangThaiLienKet) => setFilters((prev) => ({ ...prev, trangThaiLienKet, page: 0 }))}
                            />
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={loading}
                                className="h-9 gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                <RefreshCcw className="size-4" />
                                Đặt lại
                            </Button>
                        </>
                    }
                />
            </FilterPanel>

            {/* ══ BẢNG LIÊN KẾT ══ */}
            <TableShell
                title="Liên kết SKU sàn ↔ biến thể FCentric"
                description="Mỗi biến thể chỉ liên kết với 1 SKU sàn trong một gian hàng. Đổi liên kết thì lần đẩy sau sẽ đặt lại số tồn trên sàn."
                footer={
                    !loading && !loadError && rows.length > 0 ? (
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
                {loading && rows.length === 0 ? (
                    <LoadingState className="min-h-64" label="Đang tải liên kết sản phẩm" />
                ) : loadError ? (
                    <ErrorState onRetry={fetchRows} />
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={Link2}
                        title={hasFilter ? "Không có SKU phù hợp" : "Chưa có SKU nào từ sàn"}
                        description={hasFilter ? "Thử đổi trạng thái hoặc từ khóa." : "Bấm Tải lại sản phẩm để lấy danh sách SKU từ Shopify."}
                        action={
                            hasFilter ? (
                                <Button variant="outline" onClick={handleReset} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xóa bộ lọc
                                </Button>
                            ) : null
                        }
                    />
                ) : (
                    <TooltipProvider>
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead>
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    <th className={`${TH_CLASS} text-left`}>Sản phẩm trên sàn</th>
                                    <th className={`${TH_CLASS} w-[320px] text-left`}>Biến thể FCentric</th>
                                    <th className={`${TH_CLASS} text-center`}>Khả dụng</th>
                                    <th className={`${TH_CLASS} text-center`}>Sẽ đẩy</th>
                                    <th className={`${TH_CLASS} text-center`}>Đã đẩy</th>
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
                                            <td className="px-3 py-3 text-center font-semibold text-bo-foreground">{row.khaDung ?? "—"}</td>
                                            <td className="px-3 py-3 text-center">
                                                {row.soDay !== null && row.soDay !== undefined ? (
                                                    <span className="font-semibold text-bo-primary">{row.soDay}</span>
                                                ) : (
                                                    <span className="text-bo-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {row.soLuongDaDay !== null && row.soLuongDaDay !== undefined ? (
                                                    <span className="font-semibold text-bo-foreground">{row.soLuongDaDay}</span>
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
