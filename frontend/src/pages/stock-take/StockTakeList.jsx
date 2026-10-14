// src/pages/stock-take/StockTakeList.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Eye, ClipboardList, ChevronDown, ChevronLeft,
  ChevronRight, Play, SearchX,
} from "lucide-react";
import { toast } from "sonner";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { getStockTakes } from "@/services/stockTakeService";
import { hasAnyRole, ROLES } from "@/utils/roles";

// ── Trạng thái ────────────────────────────────────────────────────────────
const TRANG_THAI = {
  0: { label: "Đang kiểm kê", tone: "warning" },
  1: { label: "Hoàn thành", tone: "success" },
};

// ── Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai= ─────────
const STATUS_TABS = [
  { value: "tat-ca",       label: "Tất cả",            trangThai: null },
  { value: "dang-kiem-ke", label: TRANG_THAI[0].label, trangThai: 0 },
  { value: "hoan-thanh",   label: TRANG_THAI[1].label, trangThai: 1 },
];
const STATUS_TAB_VALUES = STATUS_TABS.map((tab) => tab.value);
const TAB_MAC_DINH = "tat-ca";
const TAB_DANG_KIEM_KE = "dang-kiem-ke";

const matchTab = (item, tab) => {
  const trangThai = STATUS_TABS.find((t) => t.value === tab)?.trangThai;
  return trangThai == null || item.trangThai === trangThai;
};

const matchSearch = (item, searchTerm) => {
  const keyword = searchTerm.trim().toLowerCase();
  return (
    !keyword ||
    item.maDotKiemKe?.toLowerCase().includes(keyword) ||
    item.tenDotKiemKe?.toLowerCase().includes(keyword) ||
    item.kho?.tenKho?.toLowerCase().includes(keyword)
  );
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const TH_CLASS =
  "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const DROPDOWN_CONTENT_CLASS =
  "backoffice-user-menu z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";

// ── Main component ────────────────────────────────────────────────────────
export default function StockTakeList() {
  const navigate = useNavigate();

  const [stockTakes,   setStockTakes]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [searchTerm,   setSearchTerm]   = useState("");
  const [tab,          setTab]          = useTabTrenUrl(STATUS_TAB_VALUES, TAB_MAC_DINH);
  const [pageNumber,   setPageNumber]   = useState(0);
  const [pageSize,     setPageSize]     = useState(10);
  // Dòng chú ý "đợt kiểm kê đang mở" chỉ cho người làm kiểm kê (R4)
  const [coQuyenKiemKe] = useState(() => hasAnyRole([ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO]));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getStockTakes();
      setStockTakes(data);
    } catch (error) {
      // Không giữ dữ liệu cũ khi lỗi (R9)
      setStockTakes([]);
      setLoadError(true);
      toast.error(error.response?.data?.message || "Không thể tải danh sách kiểm kê");
    } finally {
      setLoading(false);
    }
  }, []);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  // Đổi tab: ghi lên URL và về trang đầu
  const changeTab = (value) => {
    setTab(value);
    setPageNumber(0);
  };

  const changeSearch = (value) => {
    setSearchTerm(value);
    setPageNumber(0);
  };

  // "Xóa lọc": bỏ từ khóa, giữ tab đang chọn
  const clearSearch = () => changeSearch("");

  // Nút của dòng chú ý: mở tab Đang kiểm kê, bỏ từ khóa để số dòng khớp số trên dòng chú ý
  const showOngoing = () => {
    setSearchTerm("");
    changeTab(TAB_DANG_KIEM_KE);
  };

  // ── Client-side filter: lọc mọi thứ trừ trạng thái, rồi mới lọc theo tab ──
  const searched = useMemo(
    () => stockTakes.filter((item) => matchSearch(item, searchTerm)),
    [stockTakes, searchTerm]
  );
  const filtered = useMemo(
    () => searched.filter((item) => matchTab(item, tab)),
    [searched, tab]
  );

  // Số trên tab = số dòng sẽ thấy khi bấm tab, theo từ khóa đang tìm (R1); đang tải / lỗi thì không hiện (R9)
  const statusTabs = useMemo(
    () => STATUS_TABS.map(({ value, label }) => ({
      value,
      label,
      count: loading || loadError ? null : searched.filter((item) => matchTab(item, value)).length,
    })),
    [searched, loading, loadError]
  );

  // Dòng chú ý: đợt trạng thái 0 trên toàn dữ liệu đã tải, bỏ qua từ khóa; ẩn khi đang ở tab Đang kiểm kê
  const soDotDangMo = coQuyenKiemKe && tab !== TAB_DANG_KIEM_KE && !loading && !loadError
    ? stockTakes.filter((item) => item.trangThai === 0).length
    : null;

  // ── Pagination ────────────────────────────────────────────────────────
  const totalElements = filtered.length;
  const totalPages    = Math.max(1, Math.ceil(totalElements / pageSize));
  const safePage      = Math.min(pageNumber, totalPages - 1);
  const pageItems     = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const handlePageChange = (p) => {
    if (p >= 0 && p < totalPages) setPageNumber(p);
  };

  const dangTimKiem = Boolean(searchTerm.trim());
  const emptyTabLabel = STATUS_TABS.find((t) => t.value === tab)?.label;

  return (
    <PageContainer className="space-y-4">
      <ListPageHeader
        actions={
          <Button
            onClick={() => navigate("/stock-take/new")}
            className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
          >
            <Plus className="size-4" />
            Tạo đợt kiểm kê
          </Button>
        }
      />

      <AttentionBar
        tone="info"
        count={soDotDangMo}
        actionLabel="Xem đợt đang kiểm kê"
        onAction={showOngoing}
      >
        <strong className="font-semibold">{soDotDangMo?.toLocaleString("vi-VN")} đợt kiểm kê</strong> đang mở.
      </AttentionBar>

      {/* ── Table ── */}
      <TableShell
        toolbar={
          <ListToolbar
            tabs={
              <StatusTabs
                label="Lọc đợt kiểm kê theo trạng thái"
                tabs={statusTabs}
                value={tab}
                onChange={changeTab}
              />
            }
            hasFilter={dangTimKiem}
            onClear={clearSearch}
          >
            <SearchInput
              placeholder="Tìm theo mã đợt, tên đợt, kho..."
              label="Tìm đợt kiểm kê"
              value={searchTerm}
              onChange={(e) => changeSearch(e.target.value)}
              onClear={clearSearch}
              className="sm:w-[300px]"
            />
          </ListToolbar>
        }
        footer={!loading && !loadError && totalElements > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            {/* Page size */}
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-xs text-bo-muted">Hiển thị</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-8 w-[110px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                  >
                    {pageSize} dòng
                    <ChevronDown className="size-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={`${DROPDOWN_CONTENT_CLASS} w-[110px]`}>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() => { setPageSize(size); setPageNumber(0); }}
                      className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                    >
                      {size} dòng
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Page info */}
            <p className="text-xs text-bo-muted">
              Hiển thị{" "}
              <span className="font-semibold text-bo-foreground">{safePage * pageSize + 1}</span>
              {" – "}
              <span className="font-semibold text-bo-foreground">
                {Math.min((safePage + 1) * pageSize, totalElements)}
              </span>
              {" trong tổng số "}
              <span className="font-semibold text-bo-primary">{totalElements}</span> kết quả
            </p>

            {/* Nav */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 0}
                className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
              >
                <ChevronLeft className="size-3.5" /> Trước
              </Button>

              <div className="hidden items-center gap-1 sm:flex">
                {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                  let pageNum;
                  if (totalPages <= 5)                pageNum = idx;
                  else if (safePage < 3)              pageNum = idx;
                  else if (safePage > totalPages - 4) pageNum = totalPages - 5 + idx;
                  else                                pageNum = safePage - 2 + idx;

                  return (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className={
                        safePage === pageNum
                          ? "h-8 border-bo-primary bg-bo-primary px-2.5 text-xs text-white hover:bg-bo-primary-hover"
                          : "h-8 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle"
                      }
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage >= totalPages - 1}
                className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
              >
                Sau <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      >
        {loading ? (
          <LoadingState rows={6} label="Đang tải danh sách đợt kiểm kê" />
        ) : loadError ? (
          <ErrorState
            description="Không thể tải danh sách đợt kiểm kê. Vui lòng thử lại."
            onRetry={fetchData}
          />
        ) : pageItems.length === 0 ? (
          dangTimKiem ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy đợt kiểm kê phù hợp"
              description="Thử đổi từ khóa tìm kiếm."
              action={
                <Button
                  variant="outline"
                  onClick={clearSearch}
                  className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                >
                  Xóa lọc
                </Button>
              }
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={ClipboardList}
              title={`Không có đợt kiểm kê nào ở trạng thái "${emptyTabLabel}"`}
              description="Chọn tab Tất cả để xem mọi đợt kiểm kê."
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
              icon={ClipboardList}
              title="Chưa có đợt kiểm kê nào"
              description="Hãy tạo đợt kiểm kê đầu tiên để bắt đầu theo dõi tồn kho thực tế."
              action={
                <Button
                  onClick={() => navigate("/stock-take/new")}
                  className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                >
                  <Plus className="size-4" />
                  Tạo đợt đầu tiên
                </Button>
              }
            />
          )
        ) : (
          <table className="w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH_CLASS} w-14 text-center`}>STT</th>
                <th className={`${TH_CLASS} text-left`}>Mã đợt</th>
                <th className={`${TH_CLASS} text-left`}>Tên đợt</th>
                <th className={`${TH_CLASS} text-left`}>Kho</th>
                <th className={`${TH_CLASS} text-left`}>Người chủ trì</th>
                <th className={`${TH_CLASS} text-left`}>Ngày bắt đầu</th>
                <th className={`${TH_CLASS} text-left`}>Trạng thái</th>
                <th className={`${TH_CLASS} text-left`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {pageItems.map((item, index) => {
                const tt        = TRANG_THAI[item.trangThai] ?? TRANG_THAI[0];
                const isOngoing = item.trangThai === 0;
                return (
                  <tr key={item.id} className="transition-colors hover:bg-bo-surface-subtle">

                    <td className="px-4 py-3.5 text-center align-middle text-xs text-bo-muted">
                      {safePage * pageSize + index + 1}
                    </td>

                    {/* Mã đợt */}
                    <td className="px-4 py-3.5 align-middle">
                      <span className="rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-bo-primary">
                        {item.maDotKiemKe}
                      </span>
                    </td>

                    {/* Tên đợt */}
                    <td className="max-w-[200px] px-4 py-3.5 align-middle">
                      <span className="font-semibold leading-snug text-bo-foreground">
                        {item.tenDotKiemKe || "—"}
                      </span>
                    </td>

                    {/* Kho */}
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-medium text-bo-foreground">
                        {item.kho?.tenKho || "—"}
                      </span>
                    </td>

                    {/* Người chủ trì */}
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-medium text-bo-foreground">
                        {item.nguoiChuTri?.hoTen || "—"}
                      </span>
                    </td>

                    {/* Ngày bắt đầu */}
                    <td className="px-4 py-3.5 align-middle">
                      <span className="text-xs text-bo-muted">
                        {item.ngayBatDau
                          ? new Date(item.ngayBatDau).toLocaleDateString("vi-VN")
                          : "—"}
                      </span>
                    </td>

                    {/* Trạng thái */}
                    <td className="px-4 py-3.5 align-middle">
                      <StatusBadge label={tt.label} tone={tt.tone} />
                    </td>

                    {/* Thao tác */}
                    <td className="px-4 py-3.5 align-middle">
                      <button
                        type="button"
                        title={isOngoing ? "Tiếp tục" : "Xem chi tiết"}
                        aria-label={isOngoing ? "Tiếp tục đợt kiểm kê" : "Xem chi tiết đợt kiểm kê"}
                        onClick={() => navigate(`/stock-take/${item.id}`)}
                        className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${isOngoing
                          ? "border-bo-primary/30 bg-bo-primary-soft text-bo-primary hover:bg-bo-primary-soft/70"
                          : "border-bo-border bg-white text-bo-muted hover:border-bo-primary hover:text-bo-primary"
                          }`}
                      >
                        {isOngoing ? (
                          <Play className="size-3.5 fill-current" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
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
