import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    AlertTriangle, CheckCircle2, ClipboardList, Layers, Loader2,
    PackageCheck, RefreshCcw, ShoppingBag, Truck, X,
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
import ChannelBadge from "@/components/channel/ChannelBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { nhatHangService, isPickListMock } from "@/services/nhatHangService";
import { MARKETPLACE_FILTER_OPTIONS } from "@/constants/channel";
import { formatQuantity, toNumber } from "@/constants/outbound";
import { formatDateTime } from "@/utils/dateTime";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";

const TH_CLASS = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const CHECKBOX_CLASS = "border-slate-300 data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=checked]:text-white";
const DEFAULT_FILTERS = { keyword: "", kenh: "", page: 0, size: 10 };

export default function DonChoXuatPage() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    // Giữ lựa chọn qua nhiều trang: id -> dòng
    const [selected, setSelected] = useState(() => new Map());
    const [dialogOpen, setDialogOpen] = useState(false);
    const [ghiChu, setGhiChu] = useState("");
    const [creating, setCreating] = useState(false);
    const creatingRef = useRef(false);

    // Chờ người dùng ngừng gõ 300 ms rồi mới lọc
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setFilters((prev) => (prev.keyword === searchText ? prev : { ...prev, keyword: searchText, page: 0 }));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchText]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const kenhOption = MARKETPLACE_FILTER_OPTIONS.find((option) => option.value === filters.kenh);
            const khoId = Number(window.localStorage.getItem("selected_kho_id")) || undefined;
            const res = await nhatHangService.getDonChoXuat({
                searchText: filters.keyword.trim() || undefined,
                kenhBanId: kenhOption?.id,
                khoId,
                page: filters.page,
                size: filters.size,
            });
            setData(res?.content ?? []);
            setTotal(res?.totalElements ?? 0);
        } catch (error) {
            setLoadError(true);
            toast.error(getApiErrorMessage(error, "Không tải được danh sách đơn chờ xuất"));
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    const selectedRows = useMemo(() => [...selected.values()], [selected]);
    const selectedSummary = useMemo(() => ({
        donHang: selectedRows.length,
        sanPham: selectedRows.reduce((sum, row) => sum + toNumber(row.tongSoLuong), 0),
        thieuHang: selectedRows.filter((row) => row.duHang === false).length,
    }), [selectedRows]);

    const pageAllSelected = data.length > 0 && data.every((row) => selected.has(row.id));

    const toggleRow = (row) => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(row.id)) next.delete(row.id);
            else next.set(row.id, row);
            return next;
        });
    };

    const togglePage = () => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (pageAllSelected) data.forEach((row) => next.delete(row.id));
            else data.forEach((row) => next.set(row.id, row));
            return next;
        });
    };

    const stats = useMemo(() => ({
        duHang: data.filter((row) => row.duHang).length,
        thieuHang: data.filter((row) => row.duHang === false).length,
    }), [data]);

    const handleReset = () => {
        setSearchText("");
        setFilters(DEFAULT_FILTERS);
    };

    const handleCreate = async () => {
        if (creatingRef.current || selectedRows.length === 0) return;
        creatingRef.current = true;
        setCreating(true);
        try {
            const dto = await nhatHangService.taoPickList({
                donBanHangIds: selectedRows.map((row) => row.id),
                ghiChu: ghiChu.trim() || undefined,
            });
            toast.success(`Đã tạo ${dto?.maPickList || "Pick List"} cho ${selectedRows.length} đơn`);
            setSelected(new Map());
            setDialogOpen(false);
            setGhiChu("");
            if (dto?.id) navigate(`/goods-issues/pick-lists/${dto.id}`);
            else fetchData();
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không thể tạo Pick List"));
            if (getApiErrorStatus(error) === 409) {
                setDialogOpen(false);
                setSelected(new Map());
                fetchData();
            }
        } finally {
            creatingRef.current = false;
            setCreating(false);
        }
    };

    const hasFilter = Boolean(filters.keyword || filters.kenh);

    return (
        <PageContainer className="space-y-5">
            <MockModeNotice show={isPickListMock} />

            {/* ══ STATS ══ */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                    icon={<ClipboardList className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Đơn chờ xuất"
                    value={total}
                />
                <KpiCard
                    icon={<CheckCircle2 className="size-5" />}
                    iconClass="bg-bo-success-soft text-bo-success"
                    label="Đủ hàng (trang này)"
                    value={stats.duHang}
                />
                <KpiCard
                    icon={<AlertTriangle className="size-5" />}
                    iconClass="bg-bo-warning-soft text-bo-warning"
                    label="Thiếu hàng (trang này)"
                    value={stats.thieuHang}
                />
                <KpiCard
                    icon={<Layers className="size-5" />}
                    iconClass="bg-indigo-50 text-indigo-600"
                    label="Đã chọn để gom"
                    value={selectedSummary.donHang}
                    sub={selectedSummary.donHang ? `${formatQuantity(selectedSummary.sanPham)} sản phẩm` : "Chưa chọn đơn"}
                />
            </section>

            {/* ══ BỘ LỌC ══ */}
            <FilterPanel>
                <FilterBar
                    primary={
                        <SearchInput
                            placeholder="Nhập số đơn hoặc tên khách hàng..."
                            label="Tìm đơn chờ xuất"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            onClear={() => setSearchText("")}
                        />
                    }
                    filters={
                        <>
                            <FilterSelect
                                label="Kênh bán"
                                value={filters.kenh}
                                options={MARKETPLACE_FILTER_OPTIONS}
                                onChange={(kenh) => setFilters((prev) => ({ ...prev, kenh, page: 0 }))}
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
                    actions={
                        <>
                            <Link to="/goods-issues/pick-lists">
                                <Button
                                    variant="outline"
                                    className="h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    <Truck className="size-4" />
                                    Danh sách Pick List
                                </Button>
                            </Link>
                            <Button
                                onClick={() => setDialogOpen(true)}
                                disabled={selectedSummary.donHang === 0}
                                className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                <PackageCheck className="size-4" />
                                Tạo Pick List{selectedSummary.donHang ? ` (${selectedSummary.donHang})` : ""}
                            </Button>
                        </>
                    }
                />
            </FilterPanel>

            {/* ══ BẢNG ══ */}
            <TableShell
                title="Đơn chờ gom nhặt"
                description="Đơn đã gửi kho, chưa vào Pick List và không có cờ cần xử lý. Chọn đơn rồi bấm Tạo Pick List."
                toolbar={
                    selectedSummary.donHang > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bo-border bg-bo-primary-soft px-4 py-2.5 sm:px-5">
                            <p className="text-sm text-blue-800">
                                Đã chọn <span className="font-semibold">{selectedSummary.donHang}</span> đơn ·{" "}
                                <span className="font-semibold">{formatQuantity(selectedSummary.sanPham)}</span> sản phẩm
                                {selectedSummary.thieuHang > 0 ? ` · ${selectedSummary.thieuHang} đơn thiếu hàng` : ""}
                            </p>
                            <button
                                type="button"
                                onClick={() => setSelected(new Map())}
                                className="inline-flex items-center gap-1 text-sm font-medium text-bo-primary hover:text-bo-primary-hover"
                            >
                                <X className="size-4" />
                                Bỏ chọn
                            </button>
                        </div>
                    ) : null
                }
                footer={
                    !loading && !loadError && data.length > 0 ? (
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
                            sizeOptions={[10, 20, 50]}
                            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                            onSizeChange={(size) => setFilters((prev) => ({ ...prev, size, page: 0 }))}
                        />
                    ) : null
                }
            >
                {loading ? (
                    <LoadingState className="min-h-64" label="Đang tải đơn chờ xuất" />
                ) : loadError ? (
                    <ErrorState onRetry={fetchData} />
                ) : data.length === 0 ? (
                    <EmptyState
                        icon={ShoppingBag}
                        title={hasFilter ? "Không có đơn phù hợp" : "Không có đơn chờ xuất"}
                        description={
                            hasFilter
                                ? "Thử đổi từ khóa hoặc kênh bán."
                                : "Đơn bán đã gửi sang kho sẽ hiện ở đây để gom thành Pick List."
                        }
                        action={
                            hasFilter ? (
                                <Button variant="outline" onClick={handleReset} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xóa bộ lọc
                                </Button>
                            ) : (
                                <Link to="/sales-orders" className="text-sm font-medium text-bo-primary hover:underline">
                                    Xem đơn bán hàng
                                </Link>
                            )
                        }
                    />
                ) : (
                    <table className="w-full min-w-[1040px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH_CLASS} w-12 text-center`}>
                                    <Checkbox
                                        aria-label="Chọn tất cả đơn trong trang"
                                        checked={pageAllSelected}
                                        onCheckedChange={togglePage}
                                        className={CHECKBOX_CLASS}
                                    />
                                </th>
                                <th className={`${TH_CLASS} text-left`}>Số đơn</th>
                                <th className={`${TH_CLASS} text-left`}>Kênh</th>
                                <th className={`${TH_CLASS} text-left`}>Khách hàng</th>
                                <th className={`${TH_CLASS} text-left`}>Kho xuất</th>
                                <th className={`${TH_CLASS} text-center`}>Ngày tạo</th>
                                <th className={`${TH_CLASS} text-center`}>SKU</th>
                                <th className={`${TH_CLASS} text-center`}>Số lượng</th>
                                <th className={`${TH_CLASS} text-right`}>Tổng tiền</th>
                                <th className={`${TH_CLASS} text-center`}>Tồn kho</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((row) => {
                                const isSelected = selected.has(row.id);
                                return (
                                    <tr
                                        key={row.id}
                                        onClick={() => toggleRow(row)}
                                        className={`cursor-pointer transition-colors ${isSelected ? "bg-bo-primary-soft/60" : "hover:bg-bo-surface-subtle"}`}
                                    >
                                        <td className="px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                                            <Checkbox
                                                aria-label={`Chọn đơn ${row.soDonHang}`}
                                                checked={isSelected}
                                                onCheckedChange={() => toggleRow(row)}
                                                className={CHECKBOX_CLASS}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <Link
                                                to={`/sales-orders/${row.id}`}
                                                onClick={(event) => event.stopPropagation()}
                                                className="font-semibold uppercase tracking-wide text-bo-primary hover:underline"
                                            >
                                                {row.soDonHang}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3">
                                            <ChannelBadge maKenh={row.maKenhBan} label={row.maKenhBan ? row.tenKenhBan : undefined} />
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-bo-foreground">{row.tenKhachHang || "Khách lẻ"}</td>
                                        <td className="px-3 py-3 text-bo-muted">{row.tenKhoXuat || "—"}</td>
                                        <td className="whitespace-nowrap px-3 py-3 text-center text-xs text-bo-muted">
                                            {formatDateTime(row.ngayTao, { withYear: false }) || "—"}
                                        </td>
                                        <td className="px-3 py-3 text-center font-semibold text-bo-foreground">{row.soLuongSku ?? "—"}</td>
                                        <td className="px-3 py-3 text-center">
                                            <span className="inline-flex h-7 min-w-[32px] items-center justify-center rounded-md bg-bo-surface-subtle px-2 text-xs font-bold text-bo-foreground">
                                                {formatQuantity(row.tongSoLuong)}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-bo-foreground">
                                            {toNumber(row.tongCong).toLocaleString("vi-VN")} đ
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge
                                                label={row.khaDung || (row.duHang ? "Đủ hàng" : "Thiếu hàng")}
                                                tone={row.duHang ? "success" : "warning"}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>

            {/* ══ XÁC NHẬN TẠO PICK LIST ══ */}
            <Dialog open={dialogOpen} onOpenChange={(open) => !creating && setDialogOpen(open)}>
                <DialogContent className="rounded-xl border-bo-border sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-bo-foreground">Tạo Pick List</DialogTitle>
                        <DialogDescription className="text-slate-600">
                            Gom {selectedSummary.donHang} đơn thành một đợt nhặt hàng. Các đơn sẽ chuyển sang{" "}
                            <strong className="font-semibold text-bo-foreground">Đang xử lý xuất kho</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-bo-border">
                            <ul className="divide-y divide-bo-border">
                                {selectedRows.map((row) => (
                                    <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-bo-foreground">{row.soDonHang}</span>
                                            <span className="block truncate text-xs text-bo-muted">
                                                {row.tenKhachHang || "Khách lẻ"} · {formatQuantity(row.tongSoLuong)} sản phẩm
                                            </span>
                                        </span>
                                        <ChannelBadge maKenh={row.maKenhBan} label={row.maKenhBan ? row.tenKenhBan : undefined} />
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {selectedSummary.thieuHang > 0 ? (
                            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                <p>
                                    Có {selectedSummary.thieuHang} đơn đang báo thiếu hàng. Hệ thống sẽ kiểm tra lại khi tạo Pick List.
                                </p>
                            </div>
                        ) : null}

                        <div className="space-y-1.5">
                            <label htmlFor="pick-list-note" className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                Ghi chú (không bắt buộc)
                            </label>
                            <Textarea
                                id="pick-list-note"
                                rows={2}
                                value={ghiChu}
                                maxLength={500}
                                onChange={(event) => setGhiChu(event.target.value)}
                                placeholder="Ví dụ: Ưu tiên đơn sàn, ca sáng"
                                className="resize-none border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={creating}
                            onClick={() => setDialogOpen(false)}
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            Hủy
                        </Button>
                        <Button
                            type="button"
                            disabled={creating || selectedSummary.donHang === 0}
                            onClick={handleCreate}
                            className="min-w-[150px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {creating ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
                            {creating ? "Đang tạo..." : "Tạo Pick List"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
