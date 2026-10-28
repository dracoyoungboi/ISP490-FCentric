import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, PackageSearch, Plus, SearchX, UserPlus } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import KhoLamViecSelect from "@/components/shared/KhoLamViecSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import PickProgress from "@/components/outbound/PickProgress";
import AssignPickerDialog from "@/components/outbound/AssignPickerDialog";
import { Button } from "@/components/ui/button";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { nhatHangService, isPickListMock } from "@/services/nhatHangService";
import {
    PICK_LIST_EDITABLE, PICK_LIST_TABS, getPickListStatus,
} from "@/constants/outbound";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { formatDateTime, formatNumber } from "@/utils/formatters";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasAnyRole, ROLES } from "@/utils/roles";

const TH_CLASS = "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const DEFAULT_FILTERS = { keyword: "", page: 0, size: SO_DONG_MAC_DINH };

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const TAB_MAS = PICK_LIST_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";

/** Kho làm việc hiện tại (KhoLamViecSelect ghi vào localStorage, apiClient gửi kèm header kho_id). */
const docKhoLamViec = () => Number(window.localStorage.getItem("selected_kho_id")) || undefined;

/** Tham số gửi API dùng chung cho danh sách và số trên tab (R1, R2): chỉ khác trạng thái và trang. */
const buildParams = ({ khoId, keyword, trangThai, page, size }) => ({
    khoId,
    trangThai: trangThai || undefined,
    searchText: keyword.trim() || undefined,
    page,
    size,
});

export default function PickListList() {
    const navigate = useNavigate();
    // Quản lý kho / quản trị viên phân công (lại) được; nhân viên kho chỉ tự nhận phiếu chưa có người nhặt
    const laQuanLy = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    const tabTrangThai = PICK_LIST_TABS.find((t) => t.ma === tab)?.trangThai ?? null;
    const [khoId, setKhoId] = useState(docKhoLamViec);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const requestIdRef = useRef(0);
    const [assignTarget, setAssignTarget] = useState(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setFilters((prev) => (prev.keyword === searchText ? prev : { ...prev, keyword: searchText, page: 0 }));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchText]);

    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchData = useCallback(async ({ silent = false } = {}) => {
        // Đổi tab / kho / từ khóa liên tiếp: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setLoading(true);
            setLoadError(false);
        }
        try {
            const res = await nhatHangService.getPickLists(buildParams({
                khoId,
                keyword: filters.keyword,
                trangThai: tabTrangThai,
                page: filters.page,
                size: filters.size,
            }));
            if (requestId !== requestIdRef.current) return;
            // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
            const trangCuoi = trangCuoiNeuVuot({ trang: filters.page, kichThuoc: filters.size, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
            if (trangCuoi != null) {
                setFilters((p) => ({ ...p, page: trangCuoi }));
                return;
            }
            setData(res?.content ?? []);
            setTotal(res?.totalElements ?? 0);
            setLoadError(false);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            if (silent) throw error;
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setData([]);
            setTotal(0);
            setLoadError(true);
            toast.error(getApiErrorMessage(error, "Không tải được danh sách phiếu nhặt hàng"));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [khoId, filters, tabTrangThai]);

    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    // ── Số trên tab: cùng kho làm việc + từ khóa, chỉ thay trạng thái (R1) ──
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        async (ma) => {
            const res = await nhatHangService.getPickLists(buildParams({
                khoId,
                keyword: filters.keyword,
                trangThai: PICK_LIST_TABS.find((t) => t.ma === ma)?.trangThai,
                page: 0,
                size: 1,
            }));
            return res?.totalElements ?? 0;
        },
        `${khoId ?? ""}|${filters.keyword.trim()}`
    );

    // Đổi tab: ghi lên URL và về trang đầu
    const changeTab = (value) => {
        setTab(value);
        setFilters((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    };

    // Đổi kho làm việc: danh sách + số trên tab tải lại theo kho mới, về trang đầu
    const handleDoiKho = (id) => {
        setKhoId(id || undefined);
        setFilters((prev) => ({ ...prev, page: 0 }));
    };

    // "Xóa lọc": bỏ từ khóa, giữ tab và kho làm việc
    const clearFilters = () => {
        setSearchText("");
        setFilters((prev) => ({ ...prev, keyword: "", page: 0 }));
    };

    const handleRefresh = () => {
        fetchData();
        tabCounts.reload();
    };

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: phân công và tiến độ nhặt do nhân viên kho khác cập nhật
    const capNhat = useTaiLaiDanhSach({
        duLieu: data,
        taiNgam: () => {
            tabCounts.reload();
            return fetchData({ silent: true });
        },
        bat: !loading,
    });

    const handleAssigned = (dto) => {
        if (!dto) return;
        setData((prev) => prev.map((row) => (row.id === dto.id ? { ...row, ...dto } : row)));
        tabCounts.reload();
    };

    const hasFilter = Boolean(searchText.trim() || filters.keyword.trim());
    const dangTimKiem = Boolean(filters.keyword.trim());

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = PICK_LIST_TABS.map((t) => ({
        value: t.ma,
        label: t.label,
        count: loadError ? null : tabCounts.counts[t.ma],
    }));
    const emptyTabLabel = PICK_LIST_TABS.find((t) => t.ma === tab)?.label;

    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                actions={
                    <Link to="/goods-issues/pending-orders">
                        <Button className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                            <Plus className="size-4" />
                            Tạo phiếu nhặt hàng
                        </Button>
                    </Link>
                }
            />

            <MockModeNotice show={isPickListMock} />

            {/* ══ BẢNG ══ */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc phiếu nhặt hàng theo trạng thái"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasFilter}
                        onClear={clearFilters}
                    >
                        <KhoLamViecSelect onChange={handleDoiKho} />
                        <SearchInput
                            placeholder="Nhập mã phiếu nhặt hàng..."
                            label="Tìm phiếu nhặt hàng"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            onClear={clearFilters}
                            className="sm:w-[300px]"
                        />
                    </ListToolbar>
                }
                footer={
                    !loading && !loadError ? (
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
                            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                            onSizeChange={(size) => setFilters((prev) => ({ ...prev, size, page: 0 }))}
                            capNhat={capNhat}
                        />
                    ) : null
                }
            >
                {loading ? (
                    <LoadingState className="min-h-64" label="Đang tải danh sách phiếu nhặt hàng" />
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải danh sách phiếu nhặt hàng. Vui lòng thử lại."
                        onRetry={handleRefresh}
                    />
                ) : data.length === 0 ? (
                    dangTimKiem ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy phiếu nhặt hàng phù hợp"
                            description="Thử đổi từ khóa tìm kiếm."
                            action={
                                <Button variant="outline" onClick={clearFilters} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={PackageSearch}
                            title={`Không có phiếu nhặt hàng nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi phiếu nhặt hàng của kho đang chọn."
                            action={
                                <Button variant="outline" onClick={() => changeTab(TAB_MAC_DINH)} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={PackageSearch}
                            title="Chưa có phiếu nhặt hàng"
                            description="Chọn đơn ở màn Đơn chờ xuất để gom thành phiếu nhặt hàng đầu tiên."
                            action={
                                <Link to="/goods-issues/pending-orders" className="text-sm font-medium text-bo-primary hover:underline">
                                    Đến Đơn chờ xuất
                                </Link>
                            }
                        />
                    )
                ) : (
                    <table className="w-full min-w-[1040px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH_CLASS} text-left`}>Mã phiếu nhặt hàng</th>
                                <th className={`${TH_CLASS} text-left`}>Đơn hàng</th>
                                <th className={`${TH_CLASS} text-right tabular-nums`}>SKU</th>
                                <th className={`${TH_CLASS} w-[220px] text-left`}>Tiến độ</th>
                                <th className={`${TH_CLASS} text-left`}>Người nhặt</th>
                                <th className={`${TH_CLASS} text-left`}>Ngày tạo</th>
                                <th className={`${TH_CLASS} text-left`}>Trạng thái</th>
                                <th className={`${TH_CLASS} text-center`}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((row) => {
                                const status = getPickListStatus(row.trangThai);
                                const canAssign = PICK_LIST_EDITABLE.includes(row.trangThai) && (laQuanLy || !row.nguoiNhatId);
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
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            {row.tongSku == null ? (
                                                <span className="text-bo-muted">—</span>
                                            ) : (
                                                <span className="font-semibold text-bo-foreground">{formatNumber(row.tongSku)}</span>
                                            )}
                                        </td>
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
                                        <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">
                                            {formatDateTime(row.ngayTao)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge quyTrinh="phieuNhat" label={status.label} />
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <RowActions>
                                                {canAssign ? (
                                                    <RowActionButton
                                                        icon={UserPlus}
                                                        label={!laQuanLy ? "Nhận việc" : row.nguoiNhatId ? "Phân công lại" : "Phân công"}
                                                        onClick={() => setAssignTarget(row)}
                                                    />
                                                ) : null}
                                                <RowActionButton
                                                    icon={Eye}
                                                    label="Xem chi tiết"
                                                    onClick={() => navigate(`/goods-issues/pick-lists/${row.id}`)}
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

            <AssignPickerDialog
                open={Boolean(assignTarget)}
                onOpenChange={(open) => !open && setAssignTarget(null)}
                pickList={assignTarget}
                onAssigned={handleAssigned}
            />
        </PageContainer>
    );
}
