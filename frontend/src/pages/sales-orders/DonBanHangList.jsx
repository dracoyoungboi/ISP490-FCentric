import { useCallback, useEffect, useState } from "react";
import { donBanHangKenhService, isChannelOrderMock } from "@/services/donBanHangKenhService";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "@/services/apiClient";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  RefreshCcw,
  Check,
  Eye,
  FileText,
  Undo2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FilterBar from "@/components/shared/FilterBar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import TableShell from "@/components/shared/TableShell";
import FilterSelect from "@/components/shared/FilterSelect";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelBadge from "@/components/channel/ChannelBadge";
import OrderFlagBadges from "@/components/channel/OrderFlagBadges";
import { CHANNELS, MARKETPLACE_FILTER_OPTIONS } from "@/constants/channel";

// Lọc theo kênh (S-OC-05): filters kenhBanHang.id EQUALS <id> trên POST /don-ban-hang/filter
const ORDER_CHANNEL_OPTIONS = [
  ...MARKETPLACE_FILTER_OPTIONS,
  { value: "pos", label: "POS", id: CHANNELS.POS.id },
];

const STATUS_MAP = {
  0: { label: "Nháp", tone: "warning" },
  1: { label: "Chờ xuất kho", tone: "info" },
  2: { label: "Đã xuất kho 1 phần", tone: "info" },
  3: { label: "Đã xuất kho toàn bộ", tone: "warning" },
  4: { label: "Đã hủy", tone: "danger" },
  5: { label: "Hoàn thành", tone: "success" },
  6: { label: "Bị hoàn trả", tone: "danger" }
};

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

export default function DonBanHangList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userRoles, setUserRoles] = useState([]);

  const [filters, setFilters] = useState(() => {
    const kenhParam = (searchParams.get("kenh") || "").toLowerCase();
    return {
      keyword: "",
      trangThai: "",
      ngayDatHang: "",
      kenh: ORDER_CHANNEL_OPTIONS.some((option) => option.value === kenhParam) ? kenhParam : "",
      page: 0,
      size: 10,
    };
  });

  // Giữ ?kenh= trên URL để thẻ kênh / Dashboard mở thẳng danh sách đơn của kênh đó
  const changeKenh = (kenh) => {
    setFilters((p) => ({ ...p, kenh, page: 0 }));
    const next = new URLSearchParams(searchParams);
    if (kenh) next.set("kenh", kenh);
    else next.delete("kenh");
    setSearchParams(next, { replace: true });
  };

  // Kiểm tra quyền kho
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

  const buildFilterPayload = useCallback(() => {
    const filterList = [
      {
        fieldName: "loaiChungTu",
        operation: "EQUALS",
        value: "don_ban_hang",
      }
    ];

    if (filters.keyword?.trim()) {
      filterList.push({
        fieldName: "soDonHang",
        operation: "LIKE",
        value: filters.keyword.trim(),
      });
    }

    if (filters.trangThai !== "") {
      filterList.push({
        fieldName: "trangThai",
        operation: "EQUALS",
        value: Number(filters.trangThai),
      });
    }

    const kenhOption = ORDER_CHANNEL_OPTIONS.find((option) => option.value === filters.kenh);
    if (kenhOption?.id) {
      filterList.push({
        fieldName: "kenhBanHang.id",
        operation: "EQUALS",
        value: kenhOption.id,
      });
    }

    return {
      page: filters.page,
      size: filters.size,
      filters: filterList,
      sorts: [{ fieldName: "id", direction: "DESC" }],
    };
  }, [filters.keyword, filters.trangThai, filters.kenh, filters.page, filters.size]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const payload = buildFilterPayload();
      const res = await donBanHangKenhService.filterDonBan(payload);
      let list = res.content || [];

      if (filters.ngayDatHang) {
        list = list.filter((item) => {
          if (!item.ngayDatHang) return false;
          const date = new Date(item.ngayDatHang);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          const localDate = `${year}-${month}-${day}`;
          return localDate === filters.ngayDatHang;
        });
      }

      setData(list);
      setTotal(res.totalElements || 0);
    } finally {
      setLoading(false);
    }
  }, [buildFilterPayload, filters.ngayDatHang]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  const totalPages = Math.ceil(total / filters.size);

  const handleReset = () => {
    setFilters({
      keyword: "",
      trangThai: "",
      ngayDatHang: "",
      kenh: "",
      page: 0,
      size: 10,
    });
    if (searchParams.has("kenh")) {
      const next = new URLSearchParams(searchParams);
      next.delete("kenh");
      setSearchParams(next, { replace: true });
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setFilters((p) => ({ ...p, page: newPage }));
    }
  };

  const handlePageSizeChange = (newSize) => {
    setFilters((p) => ({ ...p, size: newSize, page: 0 }));
  };

  // Stats derived from data
  const stats = {
    total: total,
    choXuatKho: data.filter((d) => d.trangThai === 1).length,
    hoanThanh: data.filter((d) => d.trangThai === 3 || d.trangThai === 5).length,
    daHuy: data.filter((d) => d.trangThai === 4).length,
    biHoanTra: data.filter((d) => d.trangThai === 6).length,
  };

  const trangThaiLabel = filters.trangThai === ""
    ? "Tất cả trạng thái"
    : STATUS_MAP[filters.trangThai]?.label;

  return (
    <PageContainer className="space-y-5">
      <MockModeNotice show={isChannelOrderMock} />

      {/* ── Page header ── */}
      <PageHeader
        title="Đơn bán hàng"
        description="Danh sách đơn bán hàng và tiến độ xuất kho"
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

      {/* ── Stats ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-bo-muted">Tổng đơn bán</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.total}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
            <ShoppingCart className="size-5" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-bo-muted">Chờ xuất kho</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.choXuatKho}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-warning-soft text-bo-warning">
            <Clock className="size-5" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-bo-muted">Hoàn thành</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.hoanThanh}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-success-soft text-bo-success">
            <CheckCircle className="size-5" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-bo-muted">Bị hoàn trả</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.biHoanTra}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Undo2 className="size-5" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-bo-muted">Đã hủy</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.daHuy}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-danger-soft text-bo-danger">
            <XCircle className="size-5" />
          </span>
        </div>
      </section>

      {/* ── Filters ── */}
      <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-bo-border px-4 py-3 sm:px-5">
          <Filter className="size-4 text-bo-primary" />
          <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">
            Bộ lọc tìm kiếm
          </h2>
        </div>
        <FilterBar
          primary={
            <SearchInput
              placeholder="Nhập số đơn hàng..."
              value={filters.keyword}
              onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value, page: 0 }))}
              onClear={() => setFilters((p) => ({ ...p, keyword: "", page: 0 }))}
            />
          }
          filters={
            <>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[200px]"
                  >
                    <span className="truncate">{trangThaiLabel}</span>
                    <ChevronDown className="size-4 shrink-0 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                >
                  <DropdownMenuItem
                    onClick={() => setFilters((p) => ({ ...p, trangThai: "", page: 0 }))}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                  >
                    Tất cả trạng thái
                    {filters.trangThai === "" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  {Object.entries(STATUS_MAP).map(([key, value]) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => setFilters((p) => ({ ...p, trangThai: key, page: 0 }))}
                      className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                    >
                      {value.label}
                      {filters.trangThai === key && <Check className="size-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <FilterSelect
                label="Kênh bán"
                value={filters.kenh}
                options={ORDER_CHANNEL_OPTIONS}
                onChange={changeKenh}
                align="end"
              />

              <input
                type="date"
                aria-label="Ngày đặt"
                value={filters.ngayDatHang}
                onChange={(e) => setFilters((p) => ({ ...p, ngayDatHang: e.target.value, page: 0 }))}
                className="h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 sm:w-[170px]"
              />
            </>
          }
          actions={
            <Button
              variant="outline"
              onClick={handleReset}
              className="h-9 gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
            >
              <RefreshCcw className="size-4" />
              Đặt lại
            </Button>
          }
        />
      </div>

      {/* ── Table ── */}
      <TableShell
        title="Danh sách đơn bán hàng"
        description="Nhấn vào dòng để xem chi tiết đơn bán"
        footer={
          data.length > 0 ? (
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
                      {filters.size} dòng
                      <ChevronDown className="size-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="backoffice-user-menu z-50 w-[110px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                  >
                    {[10, 20, 30, 40, 50].map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => handlePageSizeChange(s)}
                        className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                      >
                        {s} dòng
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Page info */}
              <p className="text-xs text-bo-muted">
                Hiển thị{" "}
                <span className="font-semibold text-bo-foreground">{filters.page * filters.size + 1}</span>
                {" – "}
                <span className="font-semibold text-bo-foreground">
                  {Math.min((filters.page + 1) * filters.size, total)}
                </span>
                {" trong tổng số "}
                <span className="font-semibold text-bo-primary">{total}</span> kết quả
              </p>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page === 0}
                  className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                >
                  <ChevronLeft className="size-3.5" />
                  Trước
                </Button>

                <div className="hidden items-center gap-1 sm:flex">
                  {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = idx;
                    } else if (filters.page < 3) {
                      pageNum = idx;
                    } else if (filters.page > totalPages - 4) {
                      pageNum = totalPages - 5 + idx;
                    } else {
                      pageNum = filters.page - 2 + idx;
                    }

                    return (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className={
                          filters.page === pageNum
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
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page >= totalPages - 1}
                  className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                >
                  Sau
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {loading ? (
          <LoadingState rows={6} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Không tìm thấy đơn bán hàng nào"
            description="Hãy tạo một đơn bán mới hoặc điều chỉnh bộ lọc tìm kiếm."
          />
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số đơn</th>
                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Khách hàng</th>
                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kho xuất</th>
                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày chốt đơn</th>
                <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền</th>
                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {data.map((item) => (
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
                    <div className="flex items-center gap-1.5 text-bo-muted">
                      <FileText className="size-3.5 shrink-0" />
                      {item.khoXuat?.tenKho}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center text-xs text-bo-muted">
                    {new Date(item.ngayDatHang).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-semibold text-bo-foreground">
                      {item.tongCong?.toLocaleString("vi-VN")} đ
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <StatusBadge
                      label={STATUS_MAP[item.trangThai]?.label}
                      tone={STATUS_MAP[item.trangThai]?.tone}
                    />
                    {item.canXuLy ? (
                      <div className="mt-1 flex justify-center">
                        <OrderFlagBadges value={item.canXuLy} />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales-orders/${item.id}`);
                        }}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                        title="Xem chi tiết"
                      >
                        <Eye className="size-4" />
                      </button>
                    </div>
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
