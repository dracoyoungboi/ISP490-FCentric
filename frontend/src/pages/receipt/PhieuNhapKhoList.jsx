import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  ClipboardList,
  Plus,
  SearchX,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { nguoiDungService } from "@/services/nguoiDungService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import {
  GOODS_RECEIPT_TABS,
  getGoodsReceiptStatus,
} from "@/constants/goodsReceipt";
import { ROLES, getCurrentUserId } from "@/utils/roles";
import { formatDate } from "@/utils/formatters";

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const TAB_MAS = GOODS_RECEIPT_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const TAB_CHO_NHAP_KHO = "cho-nhap-kho";
const TONE_TAB = { [TAB_CHO_NHAP_KHO]: "warning" };
const trangThaiCuaTab = (ma) => GOODS_RECEIPT_TABS.find((tab) => tab.ma === ma)?.trangThai ?? null;

// Vai trò xử lý phiếu chờ nhập kho (dòng chú ý, R4)
const VAI_TRO_NHAP_KHO = [ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO];
// Ô tìm kiếm / nhà cung cấp: chỉ gọi API khi ngừng gõ
const SEARCH_DEBOUNCE_MS = 300;

const DEFAULT_FILTERS = {
  keyword: "",
  nhaCungCap: "",
  ngayNhap: "",
  page: 0,
  size: SO_DONG_MAC_DINH,
};

function parseRoles(vaiTro) {
  if (!vaiTro) return [];
  return vaiTro.split(/\s+/).filter(Boolean);
}

function buildFilterPayload(filters) {
  const filterList = [];
  if (filters.keyword?.trim()) {
    const kw = filters.keyword.trim();
    ["soPhieuNhap", "donMuaHang.soDonMua"].forEach(field => {
      filterList.push({ fieldName: field, operation: "LIKE", value: kw, logicType: "OR" });
    });
  }
  if (filters.nhaCungCap?.trim()) {
    filterList.push({ fieldName: "nhaCungCap.tenNhaCungCap", operation: "LIKE", value: filters.nhaCungCap.trim() });
  }
  if (filters.trangThai != null) {
    filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: Number(filters.trangThai) });
  }
  // Ngày nhập lọc ở máy chủ (trước đây lọc trên trang đang xem nên tổng số và số trên tab không theo ngày)
  if (filters.ngayNhap) {
    filterList.push({ fieldName: "ngayNhap", operation: "GREATER_THAN_OR_EQUAL", value: filters.ngayNhap });
    filterList.push({ fieldName: "ngayNhap", operation: "LESS_THAN_OR_EQUAL", value: `${filters.ngayNhap}T23:59:59` });
  }
  return {
    page: filters.page,
    size: filters.size,
    filters: filterList,
    sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
  };
}

// Đếm số phiếu khớp điều kiện: cùng yêu cầu của danh sách, chỉ lấy 1 dòng để đọc totalElements
async function demPhieu(filters) {
  const res = await phieuNhapKhoService.filter(buildFilterPayload({ ...filters, page: 0, size: 1 }));
  return res?.totalElements ?? 0;
}

export default function PhieuNhapKhoList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [total, setTotal] = useState(0);
  const requestIdRef = useRef(0);

  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = trangThaiCuaTab(tab);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // Ô nhập đổi ngay khi gõ; filters.keyword / filters.nhaCungCap đổi sau khi ngừng gõ
  const [keywordInput, setKeywordInput] = useState("");
  const [nhaCungCapInput, setNhaCungCapInput] = useState("");

  // Quản lý kho / Nhân viên kho thấy dòng "N phiếu đang chờ nhập kho"
  const [xuLyNhapKho, setXuLyNhapKho] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const keyword = keywordInput.trim();
      const nhaCungCap = nhaCungCapInput.trim();
      setFilters(p => (p.keyword === keyword && p.nhaCungCap === nhaCungCap
        ? p
        : { ...p, keyword, nhaCungCap, page: 0 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput, nhaCungCapInput]);

  // Vai trò đọc từ hồ sơ người dùng hiện tại (như trang Yêu cầu nhập hàng)
  useEffect(() => {
    const userId = getCurrentUserId();
    if (!userId) return undefined;
    let huy = false;
    nguoiDungService.getById(userId)
      .then((res) => {
        if (huy) return;
        const roles = parseRoles(res?.data?.vaiTro);
        setXuLyNhapKho(roles.some((role) => VAI_TRO_NHAP_KHO.includes(role)));
      })
      .catch((err) => console.error("Lỗi khi tải vai trò người dùng:", err));
    return () => { huy = true; };
  }, []);

  const fetchData = useCallback(async () => {
    // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await phieuNhapKhoService.filter(buildFilterPayload({ ...filters, trangThai: tabTrangThai }));
      if (requestId !== requestIdRef.current) return;
      setData(res.content || []);
      setTotal(res.totalElements || 0);
      setLoadError(false);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Lỗi tải danh sách phiếu nhập:", err);
      // Không giữ dòng + tổng số của lần tải trước (R9)
      setLoadError(true);
      setData([]);
      setTotal(0);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [filters, tabTrangThai]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  // ── Số trên tab: cùng từ khóa + nhà cung cấp đang lọc, chỉ thay trạng thái (R1) ──
  const tabCounts = useDemTheoTrangThai(
    TAB_MAS,
    (ma) => demPhieu({ ...filters, trangThai: trangThaiCuaTab(ma) }),
    `${filters.keyword}|${filters.nhaCungCap}|${filters.ngayNhap}`
  );

  // ── Dòng chú ý: phiếu chờ nhập kho trong phạm vi danh sách, bỏ qua các bộ lọc khác (R4) ──
  const choNhapKho = useDemTheoTrangThai(
    [TAB_CHO_NHAP_KHO],
    () => demPhieu({ ...DEFAULT_FILTERS, trangThai: trangThaiCuaTab(TAB_CHO_NHAP_KHO) }),
    TAB_CHO_NHAP_KHO,
    { enabled: xuLyNhapKho }
  );

  // Đổi tab: ghi lên URL và về trang đầu
  const changeTab = (value) => {
    setTab(value);
    setFilters(p => (p.page === 0 ? p : { ...p, page: 0 }));
  };

  const hasActiveFilters = Boolean(keywordInput.trim() || nhaCungCapInput.trim() || filters.ngayNhap);

  // "Xóa lọc": bỏ từ khóa, nhà cung cấp, ngày nhập; giữ tab đang chọn
  const clearFilters = () => {
    setKeywordInput("");
    setNhaCungCapInput("");
    setFilters(p => ({ ...DEFAULT_FILTERS, size: p.size }));
  };

  // Nút của dòng chú ý: mở tab Chờ nhập kho, bỏ các bộ lọc khác để số dòng khớp số trên dòng chú ý
  const showPending = () => {
    clearFilters();
    setTab(TAB_CHO_NHAP_KHO);
  };

  const handleRetry = () => {
    fetchData();
    tabCounts.reload();
    choNhapKho.reload();
  };

  // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
  const statusTabs = GOODS_RECEIPT_TABS.map((t) => ({
    value: t.ma,
    label: t.label,
    tone: TONE_TAB[t.ma],
    count: loadError ? null : tabCounts.counts[t.ma],
  }));

  const pendingCount = xuLyNhapKho && tab !== TAB_CHO_NHAP_KHO ? choNhapKho.counts[TAB_CHO_NHAP_KHO] : null;
  const emptyTabLabel = GOODS_RECEIPT_TABS.find((t) => t.ma === tab)?.label;

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        actions={
          <Button asChild className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
            <Link to="/goods-receipts/create">
              <Plus className="size-4" /> Tạo phiếu nhập kho
            </Link>
          </Button>
        }
      />

      <AttentionBar
        count={pendingCount}
        actionLabel="Xem phiếu chờ nhập kho"
        onAction={showPending}
      >
        <strong className="font-semibold">{pendingCount?.toLocaleString("vi-VN")} phiếu</strong> đang chờ nhập kho.
      </AttentionBar>

      {/* ── TABLE ── */}
      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={
              <StatusTabs
                label="Lọc phiếu nhập kho theo trạng thái"
                tabs={statusTabs}
                value={tab}
                onChange={changeTab}
              />
            }
            hasFilter={hasActiveFilters}
            onClear={clearFilters}
          >
            <SearchInput
              label="Tìm phiếu nhập kho"
              placeholder="Nhập số phiếu / mã đơn mua..."
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onClear={() => setKeywordInput("")}
              className="sm:w-[300px]"
            />

            <Input
              aria-label="Lọc theo tên nhà cung cấp"
              placeholder="Tên nhà cung cấp..."
              className="h-9 w-full border-bo-border bg-white text-sm text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15 sm:w-[200px]"
              value={nhaCungCapInput}
              onChange={e => setNhaCungCapInput(e.target.value)}
            />

            {/* Ngày nhập: nhãn nằm trong ô để hàng công cụ gọn một dòng */}
            <label className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto">
              <Calendar className="size-4 shrink-0 text-bo-muted" />
              <span className="shrink-0 text-xs text-bo-muted">Ngày nhập</span>
              <Input
                type="date"
                aria-label="Ngày nhập"
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0"
                value={filters.ngayNhap}
                onChange={e => setFilters(p => ({ ...p, ngayNhap: e.target.value, page: 0 }))}
              />
            </label>
          </ListToolbar>
        }
        footer={
          !loading && !loadError && data.length > 0 ? (
            <TablePagination
              page={filters.page}
              size={filters.size}
              total={total}
              onPageChange={(page) => setFilters(p => ({ ...p, page }))}
              onSizeChange={(size) => setFilters(p => ({ ...p, size, page: 0 }))}
            />
          ) : null
        }
      >
        {loading ? (
          <LoadingState rows={5} label="Đang tải danh sách phiếu nhập kho" />
        ) : loadError ? (
          <ErrorState
            description="Không thể tải danh sách phiếu nhập kho. Vui lòng thử lại."
            onRetry={handleRetry}
          />
        ) : data.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy phiếu nhập kho phù hợp"
              description="Thử đổi từ khóa, nhà cung cấp hoặc ngày nhập."
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
              icon={ClipboardList}
              title={`Không có phiếu nhập kho nào ở trạng thái "${emptyTabLabel}"`}
              description="Chọn tab Tất cả để xem mọi phiếu nhập kho."
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
              title="Chưa có phiếu nhập kho"
              description="Phiếu nhập kho từ đơn mua hàng, chuyển kho nội bộ và hoàn trả sẽ hiện ở đây."
            />
          )
        ) : (
          /* Bảng: khung giãn hết màn, thân bảng tự cuộn, tiêu đề cột đứng yên */
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className="h-10 w-14 whitespace-nowrap bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số phiếu nhập</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đơn mua / nhà cung cấp</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kho nhập</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày tạo</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày nhập</th>
                <th className="h-10 whitespace-nowrap bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {data.map((item, index) => (
                <tr
                  key={item.id}
                  onClick={() => navigate(`/goods-receipts/${item.id}`)}
                  className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                >
                  <td className="w-14 px-4 py-3 text-center align-middle">
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-bo-surface-subtle text-xs font-semibold text-bo-muted">
                      {filters.page * filters.size + index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle font-semibold text-bo-primary">
                    {item.soPhieuNhap}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-bo-foreground">{item.soDonMua || "—"}</span>
                      <span className="text-xs text-bo-muted">{item.tenNhaCungCap || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-bo-foreground">
                    {item.tenKho || item.kho?.tenKho || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center align-middle text-xs text-bo-muted">
                    {formatDate(item.ngayTao)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center align-middle text-xs text-bo-muted">
                    {item.ngayNhap ? formatDate(item.ngayNhap) : "Chưa nhập kho"}
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <StatusBadge
                      label={getGoodsReceiptStatus(item.trangThai).label}
                      tone={getGoodsReceiptStatus(item.trangThai).tone}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableShell>
    </PageContainer>
  );
}
