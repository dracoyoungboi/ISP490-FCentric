import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ClipboardCheck, Eye, ListChecks, PackageSearch, Plus,
    RefreshCcw, ScanBarcode, UserPlus, Users,
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
import PickProgress from "@/components/outbound/PickProgress";
import AssignPickerDialog from "@/components/outbound/AssignPickerDialog";
import { Button } from "@/components/ui/button";
import { nhatHangService, isPickListMock } from "@/services/nhatHangService";
import {
    PICK_LIST_EDITABLE, PICK_LIST_STATUS_OPTIONS, getPickListStatus,
} from "@/constants/outbound";
import { formatDateTime } from "@/utils/dateTime";
import { getApiErrorMessage } from "@/utils/apiError";

const TH_CLASS = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const DEFAULT_FILTERS = { keyword: "", trangThai: "", page: 0, size: 10 };

export default function PickListList() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [assignTarget, setAssignTarget] = useState(null);

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
            const khoId = Number(window.localStorage.getItem("selected_kho_id")) || undefined;
            const res = await nhatHangService.getPickLists({
                khoId,
                trangThai: filters.trangThai || undefined,
                searchText: filters.keyword.trim() || undefined,
                page: filters.page,
                size: filters.size,
            });
            setData(res?.content ?? []);
            setTotal(res?.totalElements ?? 0);
        } catch (error) {
            setLoadError(true);
            toast.error(getApiErrorMessage(error, "Không tải được danh sách Pick List"));
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    const stats = useMemo(() => ({
        choNhat: data.filter((row) => row.trangThai === "cho_nhat").length,
        dangNhat: data.filter((row) => row.trangThai === "dang_nhat").length,
        chuaPhanCong: data.filter((row) => !row.nguoiNhatId && PICK_LIST_EDITABLE.includes(row.trangThai)).length,
    }), [data]);

    const handleReset = () => {
        setSearchText("");
        setFilters(DEFAULT_FILTERS);
    };

    const handleAssigned = (dto) => {
        if (!dto) return;
        setData((prev) => prev.map((row) => (row.id === dto.id ? { ...row, ...dto } : row)));
    };

    const hasFilter = Boolean(filters.keyword || filters.trangThai);

    return (
        <PageContainer className="space-y-5">
            <MockModeNotice show={isPickListMock} />

            {/* ══ STATS ══ */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                    icon={<ListChecks className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Tổng Pick List"
                    value={total}
                />
                <KpiCard
                    icon={<ClipboardCheck className="size-5" />}
                    iconClass="bg-slate-100 text-slate-600"
                    label="Chờ nhặt (trang này)"
                    value={stats.choNhat}
                />
                <KpiCard
                    icon={<ScanBarcode className="size-5" />}
                    iconClass="bg-indigo-50 text-indigo-600"
                    label="Đang nhặt (trang này)"
                    value={stats.dangNhat}
                />
                <KpiCard
                    icon={<Users className="size-5" />}
                    iconClass="bg-bo-warning-soft text-bo-warning"
                    label="Chưa phân công (trang này)"
                    value={stats.chuaPhanCong}
                />
            </section>

            {/* ══ BỘ LỌC ══ */}
            <FilterPanel>
                <FilterBar
                    primary={
                        <SearchInput
                            placeholder="Nhập mã Pick List..."
                            label="Tìm Pick List"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            onClear={() => setSearchText("")}
                        />
                    }
                    filters={
                        <>
                            <FilterSelect
                                label="Trạng thái Pick List"
                                value={filters.trangThai}
                                options={PICK_LIST_STATUS_OPTIONS}
                                onChange={(trangThai) => setFilters((prev) => ({ ...prev, trangThai, page: 0 }))}
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
                        <Link to="/goods-issues/pending-orders">
                            <Button className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                                <Plus className="size-4" />
                                Tạo Pick List
                            </Button>
                        </Link>
                    }
                />
            </FilterPanel>

            {/* ══ BẢNG ══ */}
            <TableShell
                title="Danh sách Pick List"
                description="Nhấn vào dòng để mở màn quét mã và hoàn tất nhặt hàng"
                footer={
                    !loading && !loadError && data.length > 0 ? (
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
                {loading ? (
                    <LoadingState className="min-h-64" label="Đang tải danh sách Pick List" />
                ) : loadError ? (
                    <ErrorState onRetry={fetchData} />
                ) : data.length === 0 ? (
                    <EmptyState
                        icon={PackageSearch}
                        title={hasFilter ? "Không có Pick List phù hợp" : "Chưa có Pick List"}
                        description={
                            hasFilter
                                ? "Thử đổi trạng thái hoặc từ khóa tìm kiếm."
                                : "Chọn đơn ở màn Đơn chờ xuất để gom thành Pick List đầu tiên."
                        }
                        action={
                            hasFilter ? (
                                <Button variant="outline" onClick={handleReset} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xóa bộ lọc
                                </Button>
                            ) : (
                                <Link to="/goods-issues/pending-orders" className="text-sm font-medium text-bo-primary hover:underline">
                                    Đến Đơn chờ xuất
                                </Link>
                            )
                        }
                    />
                ) : (
                    <table className="w-full min-w-[1040px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH_CLASS} text-left`}>Mã Pick List</th>
                                <th className={`${TH_CLASS} text-left`}>Đơn hàng</th>
                                <th className={`${TH_CLASS} text-center`}>SKU</th>
                                <th className={`${TH_CLASS} w-[220px] text-left`}>Tiến độ</th>
                                <th className={`${TH_CLASS} text-left`}>Người nhặt</th>
                                <th className={`${TH_CLASS} text-center`}>Ngày tạo</th>
                                <th className={`${TH_CLASS} text-center`}>Trạng thái</th>
                                <th className={`${TH_CLASS} text-center`}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((row) => {
                                const status = getPickListStatus(row.trangThai);
                                const canAssign = PICK_LIST_EDITABLE.includes(row.trangThai);
                                const maDons = row.danhSachMaDonHang ?? [];
                                return (
                                    <tr
                                        key={row.id}
                                        onClick={() => navigate(`/goods-issues/pick-lists/${row.id}`)}
                                        className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                    >
                                        <td className="px-3 py-3">
                                            <span className="font-mono font-semibold text-bo-primary">{row.maPickList}</span>
                                            {row.ghiChu ? (
                                                <span className="mt-0.5 block max-w-[220px] truncate text-xs text-bo-muted">{row.ghiChu}</span>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="font-semibold text-bo-foreground">{row.tongDonHang ?? maDons.length} đơn</span>
                                            {maDons.length ? (
                                                <span className="mt-0.5 block max-w-[240px] truncate text-xs text-bo-muted" title={maDons.join(", ")}>
                                                    {maDons.slice(0, 2).join(", ")}{maDons.length > 2 ? ` +${maDons.length - 2}` : ""}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-3 text-center font-semibold text-bo-foreground">{row.tongSku ?? "—"}</td>
                                        <td className="px-3 py-3">
                                            <PickProgress
                                                compact
                                                daQuet={row.tongSoLuongDaQuet}
                                                canNhat={row.tongSoLuongCanNhat}
                                                percent={row.phanTramHoanThanh}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            {row.tenNguoiNhat ? (
                                                <span className="font-semibold text-bo-foreground">{row.tenNguoiNhat}</span>
                                            ) : (
                                                <span className="text-xs italic text-bo-muted">Chưa phân công</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-center text-xs text-bo-muted">
                                            {formatDateTime(row.ngayTao, { withYear: false }) || "—"}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge label={status.label} tone={status.tone} />
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {canAssign ? (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setAssignTarget(row);
                                                        }}
                                                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                                        title={row.nguoiNhatId ? "Phân công lại" : "Phân công"}
                                                    >
                                                        <UserPlus className="size-4" />
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        navigate(`/goods-issues/pick-lists/${row.id}`);
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

            <AssignPickerDialog
                open={Boolean(assignTarget)}
                onOpenChange={(open) => !open && setAssignTarget(null)}
                pickList={assignTarget}
                onAssigned={handleAssigned}
            />
        </PageContainer>
    );
}
