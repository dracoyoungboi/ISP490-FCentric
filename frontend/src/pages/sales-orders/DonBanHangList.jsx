import { formatCurrency, formatDate } from "@/utils/formatters";
import { useCallback, useEffect, useRef, useState } from "react";
import { donBanHangKenhService, isChannelOrderMock } from "@/services/donBanHangKenhService";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "@/services/apiClient";
import { getMineKhoList } from "@/services/khoService";
import {
  Calendar,
  Eye,
  FileText,
  Plus,
  SearchX,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import FilterSelect from "@/components/shared/FilterSelect";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelBadge from "@/components/channel/ChannelBadge";
import OrderFlagBadges from "@/components/channel/OrderFlagBadges";
import { CHANNELS, MARKETPLACE_FILTER_OPTIONS } from "@/constants/channel";
import { DON_BAN_HANG_TABS, getDonBanHangStatus } from "@/constants/donBanHang";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";

// Lọc theo kênh (S-OC-05): filters kenhBanHang.id EQUALS <id> trên POST /don-ban-hang/filter
const ORDER_CHANNEL_OPTIONS = [
  ...MARKETPLACE_FILTER_OPTIONS,
  { value: "pos", label: "POS", id: CHANNELS.POS.id },
];

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=, kênh trên ?kenh=
const TAB_MAS = DON_BAN_HANG_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const TAB_NHAP = "nhap";
const TONE_TAB = { [TAB_NHAP]: "warning" };
const SEARCH_DEBOUNCE_MS = 350;
const LOAD_ERROR_MESSAGE = "Không thể tải danh sách đơn bán hàng. Vui lòng thử lại.";

const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
    NHAN_VIEN_BAN_HANG: "nhan_vien_ban_hang",
};

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

// Điều kiện lọc dùng chung cho danh sách, số trên tab và dòng chú ý (R1):
// chỉ khác điều kiện trạng thái. Phạm vi theo vai trò do backend tự thêm (kho phụ trách / đơn mình tạo).
function buildFilterList({ keyword, kenh, ngay, trangThai }) {
  const filterList = [
    {
      fieldName: "loaiChungTu",
      operation: "EQUALS",
      value: "don_ban_hang",
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

  const kenhOption = ORDER_CHANNEL_OPTIONS.find((option) => option.value === kenh);
  if (kenhOption?.id) {
    filterList.push({
      fieldName: "kenhBanHang.id",
      operation: "EQUALS",
      value: kenhOption.id,
    });
  }

  // Ngày đặt: lọc ở máy chủ (trước đây chỉ lọc trên trang đang xem nên tổng số không khớp)
  if (ngay) {
    filterList.push({ fieldName: "ngayDatHang", operation: "GREATER_THAN_OR_EQUAL", value: ngay });
    filterList.push({ fieldName: "ngayDatHang", operation: "LESS_THAN_OR_EQUAL", value: `${ngay}T23:59:59` });
  }

  return filterList;
}

const countOrders = async (filters) => {
  const res = await donBanHangKenhService.filterDonBan({ filters, sorts: [], page: 0, size: 1 });
  return res?.totalElements ?? 0;
};

export default function DonBanHangList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const requestIdRef = useRef(0);
  // null = chưa đọc xong vai trò (chưa bật dòng chú ý / ghi chú phạm vi)
  const [userRoles, setUserRoles] = useState(null);
  // Kho phụ trách của vai trò kho, chỉ để ghi chú phạm vi (backend tự lọc theo kho này)
  const [khoPhuTrach, setKhoPhuTrach] = useState(null);

  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = DON_BAN_HANG_TABS.find((t) => t.ma === tab)?.trangThai ?? null;

  // Giữ ?kenh= trên URL để thẻ kênh / Dashboard mở thẳng danh sách đơn của kênh đó
  const kenhParam = (searchParams.get("kenh") || "").toLowerCase();
  const kenh = ORDER_CHANNEL_OPTIONS.some((option) => option.value === kenhParam) ? kenhParam : "";

  const [filters, setFilters] = useState({
    keyword: "",
    ngayDatHang: "",
    page: 0,
    size: SO_DONG_MAC_DINH,
  });
  // Ô tìm kiếm đổi ngay khi gõ; filters.keyword chỉ đổi khi ngừng gõ hoặc bấm Enter.
  const [searchText, setSearchText] = useState("");

  const changeKenh = (value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("kenh", value);
      else next.delete("kenh");
      return next;
    }, { replace: true });
    setFilters((p) => (p.page === 0 ? p : { ...p, page: 0 }));
  };

  // Kiểm tra quyền kho
  const roles = userRoles ?? [];
  const isAdmin = roles.includes(ROLE.QUAN_TRI_VIEN);
  const isKhoRole = roles.includes(ROLE.QUAN_LY_KHO) || roles.includes(ROLE.NHAN_VIEN_KHO);
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
                const vaiTro = parseRoles(userData.vaiTro);
                setUserRoles(vaiTro);
                // Backend giới hạn vai trò kho (không phải quản trị viên) theo kho xuất phụ trách
                if (!vaiTro.includes(ROLE.QUAN_TRI_VIEN)
                    && (vaiTro.includes(ROLE.QUAN_LY_KHO) || vaiTro.includes(ROLE.NHAN_VIEN_KHO))) {
                    try {
                        setKhoPhuTrach(await getMineKhoList());
                    } catch (error) {
                        console.error('Lỗi khi tải kho phụ trách:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin user:', error);
        }
    };
    fetchUserInfo();
  }, []);

  // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    // Đổi tab / bộ lọc liên tiếp: chỉ nhận kết quả của yêu cầu mới nhất
    const requestId = ++requestIdRef.current;
    if (!silent) setLoading(true);
    try {
      const res = await donBanHangKenhService.filterDonBan({
        page: filters.page,
        size: filters.size,
        filters: buildFilterList({ keyword: filters.keyword, kenh, ngay: filters.ngayDatHang, trangThai: tabTrangThai }),
        sorts: [{ fieldName: "id", direction: "DESC" }],
      });
      if (requestId !== requestIdRef.current) return;
      // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
      const trangCuoi = trangCuoiNeuVuot({ trang: filters.page, kichThuoc: filters.size, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
      if (trangCuoi != null) {
        setFilters((p) => ({ ...p, page: trangCuoi }));
        return;
      }
      setData(res?.content || []);
      setTotal(res?.totalElements || 0);
      setLoadError(false);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error(error);
      if (silent) throw error;
      // Không giữ dòng + tổng số của lần tải trước (R9)
      setData([]);
      setTotal(0);
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
    // tabTrangThai là mảng hằng trong DON_BAN_HANG_TABS, chỉ đổi khi đổi tab
  }, [filters, kenh, tabTrangThai]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  // ── Số trên tab: cùng số đơn + kênh + ngày đặt đang lọc, chỉ thay trạng thái (R1) ──
  const tabCounts = useDemTheoTrangThai(
    TAB_MAS,
    (ma) => countOrders(buildFilterList({
      keyword: filters.keyword,
      kenh,
      ngay: filters.ngayDatHang,
      trangThai: DON_BAN_HANG_TABS.find((t) => t.ma === ma)?.trangThai,
    })),
    `${filters.keyword}|${kenh}|${filters.ngayDatHang}`
  );

  // ── Dòng chú ý: đơn nháp chưa gửi kho trong phạm vi danh sách, bỏ qua các bộ lọc khác (R4) ──
  const canSeeDrafts = roles.includes(ROLE.NHAN_VIEN_BAN_HANG) || isAdmin;
  const donNhap = useDemTheoTrangThai(
    [TAB_NHAP],
    () => countOrders(buildFilterList({ trangThai: [0] })),
    "don-nhap",
    { enabled: userRoles !== null && canSeeDrafts }
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

  const hasActiveFilters = Boolean(searchText.trim() || filters.ngayDatHang || kenh);

  // "Xóa lọc": bỏ số đơn + kênh + ngày đặt, giữ tab đang chọn
  const clearFilters = () => {
    setSearchText("");
    setFilters((p) => ({ ...p, keyword: "", ngayDatHang: "", page: 0 }));
    if (kenh) changeKenh("");
  };

  // Nút của dòng chú ý: mở tab Nháp, bỏ các bộ lọc khác (kể cả kênh) để số dòng khớp số trong câu
  const showDrafts = () => {
    setSearchText("");
    setFilters((p) => ({ ...p, keyword: "", ngayDatHang: "", page: 0 }));
    setTab(TAB_NHAP, { kenh: null });
  };

  const handleRetry = () => {
    fetchData();
    tabCounts.reload();
    donNhap.reload();
  };

  // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: đơn từ POS, Shopify; kho đổi trạng thái khi nhặt, đóng gói, xuất
  const capNhat = useTaiLaiDanhSach({
    duLieu: data,
    taiNgam: () => {
      tabCounts.reload();
      donNhap.reload();
      return fetchData({ silent: true });
    },
    bat: !loading,
  });

  // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
  const statusTabs = DON_BAN_HANG_TABS.map((t) => ({
    value: t.ma,
    label: t.label,
    tone: TONE_TAB[t.ma],
    count: loadError ? null : tabCounts.counts[t.ma],
  }));

  // Ghi chú phạm vi (R3) theo đúng điều kiện backend tự thêm ở DonBanHangService.filter:
  // quản trị viên xem tất cả; vai trò kho theo kho xuất phụ trách; còn lại NV bán hàng chỉ thấy đơn mình tạo.
  const scopeNote = userRoles === null || isAdmin
    ? null
    : isKhoRole
      ? khoPhuTrach === null
        ? null
        : khoPhuTrach.length > 0
          ? `Kho bạn phụ trách: ${khoPhuTrach.map((k) => k.tenKho).join(", ")}`
          : "Bạn chưa được phân công kho nào nên danh sách đang trống."
      : roles.includes(ROLE.NHAN_VIEN_BAN_HANG)
        ? "Đơn bán hàng bạn tạo"
        : null;

  const draftCount = canSeeDrafts && tab !== TAB_NHAP ? donNhap.counts[TAB_NHAP] : null;
  const emptyTabLabel = DON_BAN_HANG_TABS.find((t) => t.ma === tab)?.label;

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        scope={scopeNote}
        actions={
          !isKhoRole ? (
            <Link to="/sales-orders/create">
              <Button className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover">
                <Plus className="size-4" />
                Tạo đơn bán
              </Button>
            </Link>
          ) : null
        }
      />

      <MockModeNotice show={isChannelOrderMock} />

      <AttentionBar
        count={draftCount}
        actionLabel="Xem đơn nháp"
        onAction={showDrafts}
      >
        <strong className="font-semibold">{draftCount?.toLocaleString("vi-VN")} đơn nháp</strong> chưa gửi kho.
      </AttentionBar>

      {/* ── Table ── */}
      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={
              <StatusTabs
                label="Lọc đơn bán hàng theo trạng thái"
                tabs={statusTabs}
                value={tab}
                onChange={changeTab}
              />
            }
            hasFilter={hasActiveFilters}
            onClear={clearFilters}
          >
            <SearchInput
              label="Tìm đơn bán hàng"
              placeholder="Nhập số đơn hàng..."
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

            <FilterSelect
              label="Kênh bán"
              value={kenh}
              options={ORDER_CHANNEL_OPTIONS}
              onChange={changeKenh}
              align="end"
            />

            {/* Ngày đặt: nhãn nằm trong ô để hàng công cụ gọn một dòng */}
            <label className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto">
              <Calendar className="size-4 shrink-0 text-bo-muted" />
              <span className="shrink-0 text-xs text-bo-muted">Ngày đặt</span>
              <Input
                type="date"
                aria-label="Ngày đặt"
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0"
                value={filters.ngayDatHang}
                onChange={(e) => setFilters((p) => ({ ...p, ngayDatHang: e.target.value, page: 0 }))}
              />
            </label>
          </ListToolbar>
        }
        footer={
          !loadError && (total > 0 || !loading) ? (
            <TablePagination
              page={filters.page}
              size={filters.size}
              total={total}
              onPageChange={(page) => {
                if (page < 0) return;
                setFilters((p) => ({ ...p, page }));
              }}
              onSizeChange={(size) => setFilters((p) => (p.size === size ? p : { ...p, size, page: 0 }))}
              capNhat={capNhat}
            />
          ) : null
        }
      >
        {loading ? (
          <LoadingState label="Đang tải danh sách đơn bán hàng" />
        ) : loadError ? (
          <ErrorState description={LOAD_ERROR_MESSAGE} onRetry={handleRetry} />
        ) : data.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy đơn bán hàng phù hợp"
              description="Thử đổi số đơn, kênh bán hoặc ngày đặt."
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
              icon={ShoppingCart}
              title={`Không có đơn bán hàng nào ở trạng thái "${emptyTabLabel}"`}
              description="Chọn tab Tất cả để xem mọi đơn bán hàng."
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
              icon={ShoppingCart}
              title="Chưa có đơn bán hàng"
              description="Đơn bán hàng được tạo khi chốt báo giá, bán tại quầy hoặc nhận từ sàn."
            />
          )
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số đơn</th>
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Khách hàng</th>
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kho xuất</th>
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày chốt đơn</th>
                <th className="h-10 whitespace-nowrap px-3 text-right tabular-nums text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền</th>
                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                <th className="h-10 whitespace-nowrap px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {data.map((item) => {
                const st = getDonBanHangStatus(item.trangThai);
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                    onClick={() => navigate(`/sales-orders/${item.id}`)}
                  >
                    <td className="px-3 py-3">
                      <span className="font-semibold uppercase tracking-wide text-bo-primary">{item.soDonHang}</span>
                      {item.kenhBanHang ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <ChannelBadge
                            className="h-5 px-1.5 text-[11px]"
                            maKenh={item.kenhBanHang.maKenh}
                            label={item.kenhBanHang.tenKenh}
                          />
                          {item.maDonHangKenh ? (
                            <span className="font-mono text-[11px] text-bo-muted">#{item.maDonHangKenh}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-bo-foreground">
                        {item.khachHang?.tenKhachHang || "Khách lẻ"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {item.khoXuat?.tenKho ? (
                        <div className="flex items-center gap-1.5 text-bo-muted">
                          <FileText className="size-3.5 shrink-0" />
                          {item.khoXuat.tenKho}
                        </div>
                      ) : (
                        <span className="text-bo-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">
                      {formatDate(item.ngayDatHang)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold text-bo-foreground">
                        {formatCurrency(item.tongCong)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge quyTrinh="donBan" label={st.label} />
                      {item.canXuLy ? (
                        <div className="mt-1 flex">
                          <OrderFlagBadges value={item.canXuLy} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <RowActions>
                        <RowActionButton
                          icon={Eye}
                          label="Xem chi tiết"
                          onClick={() => navigate(`/sales-orders/${item.id}`)}
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
