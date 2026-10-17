import { formatCurrency, formatDate } from "@/utils/formatters";
import { useCallback, useEffect, useRef, useState } from "react";
import { donBanHangService } from "@/services/donBanHangService";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "@/services/apiClient";
import {
  Calendar,
  Eye,
  FileText,
  Plus,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import PageContainer from "@/components/backoffice/PageContainer";
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
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { BAO_GIA_TABS, getBaoGiaStatus } from "@/constants/baoGia";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";

const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
    NHAN_VIEN_BAN_HANG: "nhan_vien_ban_hang",
};

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const TAB_MAS = BAO_GIA_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const SEARCH_DEBOUNCE_MS = 350;
const LOAD_ERROR_MESSAGE = "Không thể tải danh sách báo giá. Vui lòng thử lại.";

function parseJwt(token) {
    try {
        const b64 = token.split(".")[1];
        return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    } catch { return null; }
}

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

// Điều kiện lọc dùng chung cho danh sách và số trên tab (R1): chỉ khác điều kiện trạng thái.
// Phạm vi theo vai trò do backend tự thêm (NV bán hàng: báo giá mình tạo).
function buildFilterList({ keyword, ngay, trangThai }) {
  // LỌC CHỨNG TỪ BÁO GIÁ
  const filterList = [
    {
      fieldName: "loaiChungTu",
      operation: "EQUALS",
      value: "bao_gia",
    }
  ];

  if (keyword) {
    filterList.push({
      fieldName: "soDonHang",
      operation: "LIKE",
      value: keyword,
    });
  }

  if (trangThai?.length === 1) {
    filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: trangThai[0] });
  } else if (trangThai?.length > 1) {
    filterList.push({ fieldName: "trangThai", operation: "IN", value: trangThai });
  }

  // Ngày lập: lọc ở máy chủ (trước đây chỉ lọc trên trang đang xem nên tổng số không khớp)
  if (ngay) {
    filterList.push({ fieldName: "ngayDatHang", operation: "GREATER_THAN_OR_EQUAL", value: ngay });
    filterList.push({ fieldName: "ngayDatHang", operation: "LESS_THAN_OR_EQUAL", value: `${ngay}T23:59:59` });
  }

  return filterList;
}

export default function BaoGiaList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const requestIdRef = useRef(0);
  const [userRoles, setUserRoles] = useState([]);

  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = BAO_GIA_TABS.find((t) => t.ma === tab)?.trangThai ?? null;

  const [filters, setFilters] = useState({
    keyword: "",
    ngayDatHang: "",
    page: 0,
    size: SO_DONG_MAC_DINH,
  });
  // Ô tìm kiếm đổi ngay khi gõ; filters.keyword chỉ đổi khi ngừng gõ hoặc bấm Enter.
  const [searchText, setSearchText] = useState("");

  const isKhoRole = userRoles.includes(ROLE.QUAN_LY_KHO) || userRoles.includes(ROLE.NHAN_VIEN_KHO);

  useEffect(() => {
    const fetchUserInfo = async () => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) return;
            const payload = parseJwt(token);
            if (!payload || !payload.id) return;

            const userResponse = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
            const userData = userResponse.data?.data;
            if (userData && userData.vaiTro) {
                setUserRoles(parseRoles(userData.vaiTro));
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin user:', error);
        }
    };
    fetchUserInfo();
  }, []);

  const fetchData = useCallback(async () => {
    // Đổi tab / bộ lọc liên tiếp: chỉ nhận kết quả của yêu cầu mới nhất
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await donBanHangService.filter({
        page: filters.page,
        size: filters.size,
        filters: buildFilterList({ keyword: filters.keyword, ngay: filters.ngayDatHang, trangThai: tabTrangThai }),
        sorts: [{ fieldName: "id", direction: "DESC" }],
      });
      if (requestId !== requestIdRef.current) return;
      setData(res?.content || []);
      setTotal(res?.totalElements || 0);
      setLoadError(false);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error(error);
      // Không giữ dòng + tổng số của lần tải trước (R9)
      setData([]);
      setTotal(0);
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
    // tabTrangThai là mảng hằng trong BAO_GIA_TABS, chỉ đổi khi đổi tab
  }, [filters, tabTrangThai]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  // ── Số trên tab: cùng mã báo giá + ngày lập đang lọc, chỉ thay trạng thái (R1) ──
  const tabCounts = useDemTheoTrangThai(
    TAB_MAS,
    async (ma) => {
      const res = await donBanHangService.filter({
        page: 0,
        size: 1,
        filters: buildFilterList({
          keyword: filters.keyword,
          ngay: filters.ngayDatHang,
          trangThai: BAO_GIA_TABS.find((t) => t.ma === ma)?.trangThai,
        }),
        sorts: [],
      });
      return res?.totalElements ?? 0;
    },
    `${filters.keyword}|${filters.ngayDatHang}`
  );

  // ── Debounce ô tìm kiếm: không gọi API ở mỗi lần gõ phím ──
  useEffect(() => {
    const keyword = searchText.trim();
    const timer = setTimeout(() => {
      setFilters((p) => (p.keyword === keyword ? p : { ...p, keyword, page: 0 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const applyKeyword = (keyword) => {
    setFilters((p) => (p.keyword === keyword ? p : { ...p, keyword, page: 0 }));
  };

  // Đổi tab: ghi lên URL (F5 / quay lại vẫn đúng tab) và về trang đầu
  const changeTab = (value) => {
    setTab(value);
    setFilters((p) => (p.page === 0 ? p : { ...p, page: 0 }));
  };

  const hasActiveFilters = Boolean(searchText.trim() || filters.ngayDatHang);

  // "Xóa lọc": bỏ mã báo giá + ngày lập, giữ tab đang chọn
  const clearFilters = () => {
    setSearchText("");
    setFilters((p) => ({ ...p, keyword: "", ngayDatHang: "", page: 0 }));
  };

  const handleRetry = () => {
    fetchData();
    tabCounts.reload();
  };

  // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
  const statusTabs = BAO_GIA_TABS.map((t) => ({
    value: t.ma,
    label: t.label,
    count: loadError ? null : tabCounts.counts[t.ma],
  }));

  // Ghi chú phạm vi (R3) theo đúng điều kiện backend tự thêm ở DonBanHangService.filter:
  // quản trị viên xem tất cả; vai trò kho theo kho xuất phụ trách; còn lại NV bán hàng chỉ thấy báo giá mình tạo.
  const scopeNote = userRoles.length === 0 || userRoles.includes(ROLE.QUAN_TRI_VIEN)
    ? null
    : isKhoRole
      ? "Báo giá xuất từ kho bạn phụ trách"
      : userRoles.includes(ROLE.NHAN_VIEN_BAN_HANG)
        ? "Báo giá bạn tạo"
        : null;

  const emptyTabLabel = BAO_GIA_TABS.find((t) => t.ma === tab)?.label;

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        scope={scopeNote}
        actions={
          !isKhoRole ? (
            <Link to="/sales-quotations/create">
              <Button className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover">
                <Plus className="size-4" />
                Tạo báo giá mới
              </Button>
            </Link>
          ) : null
        }
      />

      {/* ── Table ── */}
      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={
              <StatusTabs
                label="Lọc báo giá theo trạng thái"
                tabs={statusTabs}
                value={tab}
                onChange={changeTab}
              />
            }
            hasFilter={hasActiveFilters}
            onClear={clearFilters}
          >
            <SearchInput
              label="Tìm báo giá"
              placeholder="Nhập mã báo giá..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyKeyword(searchText.trim());
              }}
              onClear={() => {
                setSearchText("");
                applyKeyword("");
              }}
              className="sm:w-[300px]"
            />

            {/* Ngày lập: nhãn nằm trong ô để hàng công cụ gọn một dòng */}
            <label className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto">
              <Calendar className="size-4 shrink-0 text-bo-muted" />
              <span className="shrink-0 text-xs text-bo-muted">Ngày lập</span>
              <Input
                type="date"
                aria-label="Ngày lập"
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0"
                value={filters.ngayDatHang}
                onChange={(e) => setFilters((p) => ({ ...p, ngayDatHang: e.target.value, page: 0 }))}
              />
            </label>
          </ListToolbar>
        }
        footer={
          !loadError && total > 0 ? (
            <TablePagination
              page={filters.page}
              size={filters.size}
              total={total}
              onPageChange={(page) => {
                if (page < 0) return;
                setFilters((p) => ({ ...p, page }));
              }}
              onSizeChange={(size) => setFilters((p) => (p.size === size ? p : { ...p, size, page: 0 }))}
            />
          ) : null
        }
      >
        {loading ? (
          <LoadingState label="Đang tải danh sách báo giá" />
        ) : loadError ? (
          <ErrorState description={LOAD_ERROR_MESSAGE} onRetry={handleRetry} />
        ) : data.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy báo giá phù hợp"
              description="Thử đổi mã báo giá hoặc ngày lập."
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
              icon={FileText}
              title={`Không có báo giá nào ở trạng thái "${emptyTabLabel}"`}
              description="Chọn tab Tất cả để xem mọi báo giá."
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
              icon={FileText}
              title="Chưa có báo giá"
              description="Báo giá gửi khách hàng sẽ hiện ở đây. Khi khách đồng ý, báo giá được chốt thành đơn bán hàng."
            />
          )
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className="h-10 whitespace-nowrap px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mã báo giá</th>
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Khách hàng</th>
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày lập</th>
                <th className="h-10 whitespace-nowrap px-3 text-right tabular-nums text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền</th>
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                <th className="h-10 whitespace-nowrap px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {data.map((item, index) => {
                const st = getBaoGiaStatus(item.trangThai);
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                    onClick={() => navigate(`/sales-quotations/${item.id}`)}
                  >
                    <td className="px-3 py-3 text-center text-xs text-bo-muted">
                      {filters.page * filters.size + index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-semibold uppercase tracking-wide text-bo-primary">{item.soDonHang}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-bo-foreground">{item.khachHang?.tenKhachHang || "Khách lẻ"}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">
                      {formatDate(item.ngayTao)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold text-bo-foreground">
                        {formatCurrency(item.tongCong)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge label={st.label} />
                    </td>
                    <td className="px-3 py-3">
                      <RowActions>
                        <RowActionButton
                          icon={Eye}
                          label="Xem chi tiết"
                          onClick={() => navigate(`/sales-quotations/${item.id}`)}
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
