// src/pages/stock-take/StockTakeList.jsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
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
import { Button } from "@/components/ui/button";
import { Plus, Eye, ClipboardList, Play, SearchX } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { getStockTakes } from "@/services/stockTakeService";
import { hasAnyRole, ROLES } from "@/utils/roles";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { trangThaiLa } from "@/constants/trangThaiChung";
import { formatDate } from "@/utils/formatters";

// ── Trạng thái (màu thẻ tra theo tên ở constants/trangThai) ──────────────
const TRANG_THAI = {
  0: { label: "Đang kiểm kê" },
  1: { label: "Hoàn thành" },
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

const TH_CLASS =
  "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// ── Main component ────────────────────────────────────────────────────────
export default function StockTakeList() {
  const navigate = useNavigate();

  const [stockTakes,   setStockTakes]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [searchTerm,   setSearchTerm]   = useState("");
  const [tab,          setTab]          = useTabTrenUrl(STATUS_TAB_VALUES, TAB_MAC_DINH);
  const [pageNumber,   setPageNumber]   = useState(0);
  const [pageSize,     setPageSize]     = useState(SO_DONG_MAC_DINH);
  // Dòng chú ý "đợt kiểm kê đang mở" chỉ cho người làm kiểm kê (R4)
  const [coQuyenKiemKe] = useState(() => hasAnyRole([ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO]));

  // Chỉ nhận kết quả của lần tải mới nhất: lần tải ngầm về chậm không đè dữ liệu tải sau một thao tác
  const requestIdRef = useRef(0);
  // silent: tải lại ngầm khi quay lại tab — giữ bảng đang xem, lỗi chỉ ghi log
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (!silent) {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const data = await getStockTakes();
      if (requestId !== requestIdRef.current) return;
      setStockTakes(data);
      setLoadError(false);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      if (silent) {
        console.error(error);
        return;
      }
      // Không giữ dữ liệu cũ khi lỗi (R9)
      setStockTakes([]);
      setLoadError(true);
      toast.error(error.response?.data?.message || "Không thể tải danh sách kiểm kê");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  // Quay lại tab thì tải lại ngầm (đợt kiểm kê do nhân viên kho khác mở / hoàn thành)
  useTaiLaiKhiQuayLai(() => fetchData({ silent: true }), { bat: !loading });

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
    <PageContainer fill className="space-y-4">
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
        fill
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
          <TablePagination
            page={safePage}
            size={pageSize}
            total={totalElements}
            onPageChange={handlePageChange}
            onSizeChange={(size) => { setPageSize(size); setPageNumber(0); }}
          />
        ) : null}
      >
        {loading ? (
          <LoadingState rows={6} label="Đang tải danh sách đợt kiểm kê" />
        ) : loadError ? (
          <ErrorState
            description="Không thể tải danh sách đợt kiểm kê. Vui lòng thử lại."
            onRetry={() => fetchData()}
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
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH_CLASS} w-14 text-center`}>STT</th>
                <th className={`${TH_CLASS} text-left`}>Mã đợt</th>
                <th className={`${TH_CLASS} text-left`}>Tên đợt</th>
                <th className={`${TH_CLASS} text-left`}>Kho</th>
                <th className={`${TH_CLASS} text-left`}>Người chủ trì</th>
                <th className={`${TH_CLASS} text-left`}>Ngày bắt đầu</th>
                <th className={`${TH_CLASS} text-left`}>Trạng thái</th>
                <th className={`${TH_CLASS} text-center`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {pageItems.map((item, index) => {
                const tt        = TRANG_THAI[item.trangThai] ?? trangThaiLa(item.trangThai);
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
                        {formatDate(item.ngayBatDau)}
                      </span>
                    </td>

                    {/* Trạng thái */}
                    <td className="px-4 py-3.5 align-middle">
                      <StatusBadge quyTrinh="kiemKe" label={tt.label} />
                    </td>

                    {/* Thao tác */}
                    <td className="px-4 py-3.5 align-middle">
                      <RowActions>
                        <RowActionButton
                          icon={isOngoing ? Play : Eye}
                          label={isOngoing ? "Tiếp tục kiểm kê" : "Xem chi tiết"}
                          onClick={() => navigate(`/stock-take/${item.id}`)}
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
