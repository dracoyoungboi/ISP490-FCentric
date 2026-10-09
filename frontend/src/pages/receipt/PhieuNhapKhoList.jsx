import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Filter,
  Package,
  Plus,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FilterBar from "@/components/shared/FilterBar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import {
  GOODS_RECEIPT_FILTER_STATUSES,
  GOODS_RECEIPT_STATUS,
  getGoodsReceiptStatus,
} from "@/constants/goodsReceipt";

// Bộ lọc chỉ gồm các trạng thái backend thực sự dùng (0 / 3 / 4)
const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  ...GOODS_RECEIPT_FILTER_STATUSES.map((value) => ({
    value: String(value),
    label: GOODS_RECEIPT_STATUS[value].label,
  })),
];

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
  if (filters.trangThai !== "") {
    filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: Number(filters.trangThai) });
  }
  return {
    page: filters.page,
    size: filters.size,
    filters: filterList,
    sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
  };
}

export default function PhieuNhapKhoList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    keyword: "",
    nhaCungCap: "",     // thay vì tenKho
    trangThai: "",
    ngayNhap: "",
    page: 0,
    size: 10,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await phieuNhapKhoService.filter(buildFilterPayload(filters));
      let finalData = res.content || [];

      // Lọc ngày nhập (client-side)
      if (filters.ngayNhap) {
        finalData = finalData.filter(item => {
          if (!item.ngayNhap) return false;
          const date = new Date(item.ngayNhap);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}` === filters.ngayNhap;
        });
      }

      setData(finalData);
      setTotal(res.totalElements || 0);
    } catch (err) {
      console.error("Lỗi tải danh sách phiếu nhập:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / filters.size));

  const handleReset = () => {
    setFilters({ keyword: "", nhaCungCap: "", trangThai: "", ngayNhap: "", page: 0, size: 10 });
  };

  const stats = useMemo(() => ({
    nhap: data.filter(d => d.trangThai === 0).length,
    daNhap: data.filter(d => d.trangThai === 3).length,
    daHuy: data.filter(d => d.trangThai === 4).length,
  }), [data]);

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        
        title="Phiếu nhập kho"
        description="Theo dõi toàn bộ phiếu nhập kho từ đối tác, luân chuyển nội bộ và hoàn trả."
        actions={
          <Link to="/goods-receipts/create">
            <Button className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
              <Plus className="size-4" /> Tạo Phiếu Nhập Kho
            </Button>
          </Link>
        }
      />

      {/* ── STATS ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Package className="size-4" />}
          iconClass="bg-bo-primary-soft text-bo-primary"
          label="Tổng phiếu nhập"
          value={total}
        />
        <StatTile
          icon={<FileText className="size-4" />}
          iconClass="bg-bo-warning-soft text-bo-warning"
          label={GOODS_RECEIPT_STATUS[0].label}
          value={stats.nhap}
        />
        <StatTile
          icon={<CheckCircle2 className="size-4" />}
          iconClass="bg-bo-success-soft text-bo-success"
          label={GOODS_RECEIPT_STATUS[3].label}
          value={stats.daNhap}
        />
        <StatTile
          icon={<XCircle className="size-4" />}
          iconClass="bg-bo-danger-soft text-bo-danger"
          label={GOODS_RECEIPT_STATUS[4].label}
          value={stats.daHuy}
        />
      </section>

      {/* ── FILTER ── */}
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
              placeholder="Nhập số phiếu / PO..."
              value={filters.keyword}
              onChange={e => setFilters(p => ({ ...p, keyword: e.target.value, page: 0 }))}
              onClear={() => setFilters(p => ({ ...p, keyword: "", page: 0 }))}
            />
          }
          filters={
            <>
              <Input
                placeholder="Tên nhà cung cấp..."
                className="h-9 w-full border-bo-border bg-white text-sm text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15 sm:w-[200px]"
                value={filters.nhaCungCap}
                onChange={e => setFilters(p => ({ ...p, nhaCungCap: e.target.value, page: 0 }))}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[190px]"
                  >
                    <span className="truncate">
                      {STATUS_OPTIONS.find(s => s.value === filters.trangThai)?.label || "Tất cả trạng thái"}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="backoffice-user-menu z-50 w-[190px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                >
                  {STATUS_OPTIONS.map(s => (
                    <DropdownMenuItem
                      key={s.value}
                      onClick={() => setFilters(p => ({ ...p, trangThai: s.value, page: 0 }))}
                      className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                    >
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Input
                type="date"
                value={filters.ngayNhap}
                onChange={e => setFilters(p => ({ ...p, ngayNhap: e.target.value, page: 0 }))}
                className="h-9 w-full border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15 sm:w-[170px]"
                disabled={loading}
              />

              <Button
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                className="h-9 gap-2 border-bo-border bg-white text-sm text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
              >
                <RefreshCcw className="size-4" /> Đặt lại
              </Button>
            </>
          }
        />
      </div>

      {/* ── TABLE / LOADING / EMPTY ── */}
      {loading ? (
        <TableShell>
          <LoadingState rows={5} label="Đang tải danh sách phiếu nhập kho" />
        </TableShell>
      ) : data.length === 0 ? (
        <TableShell>
          <EmptyState
            icon={ClipboardList}
            title="Không tìm thấy phiếu nhập kho"
            description="Hiện tại chưa có dữ liệu phù hợp. Hãy thử thay đổi bộ lọc hoặc từ khoá tìm kiếm."
          />
        </TableShell>
      ) : (
        <>
          <TableShell>
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-bo-border bg-bo-surface-subtle">
                    <th className="h-10 w-14 bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                    <th className="h-10 bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số phiếu nhập</th>
                    <th className="h-10 bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">PO / Nhà cung cấp</th>
                    <th className="h-10 bg-bo-surface-subtle px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kho nhập</th>
                    <th className="h-10 bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày tạo</th>
                    <th className="h-10 bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày nhập</th>
                    <th className="h-10 bg-bo-surface-subtle px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
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
                        {new Date(item.ngayTao).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center align-middle text-xs text-bo-muted">
                        {item.ngayNhap ? new Date(item.ngayNhap).toLocaleDateString("vi-VN") : "Chưa nhập kho"}
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
            </div>
          </TableShell>

          {/* ── PAGINATION ── */}
          <div className="rounded-lg border border-bo-border bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Page size */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bo-muted">Hiển thị:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-8 w-[120px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                      >
                        {filters.size} dòng
                        <ChevronDown className="size-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="backoffice-user-menu z-50 w-[120px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                    >
                      {[5, 10, 20, 50, 100].map(size => (
                        <DropdownMenuItem
                          key={size}
                          onClick={() => setFilters(p => ({ ...p, size, page: 0 }))}
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
                  <span className="font-semibold text-bo-foreground">
                    {data.length > 0 ? filters.page * filters.size + 1 : 0}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-bo-foreground">
                    {Math.min((filters.page + 1) * filters.size, total)}
                  </span>{" "}
                  trong tổng số{" "}
                  <span className="font-semibold text-bo-primary">{total}</span> kết quả
                </p>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
                    disabled={filters.page === 0}
                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                  >
                    <ChevronLeft className="size-3.5" /> Trước
                  </Button>

                  <div className="hidden items-center gap-1 sm:flex">
                    {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = idx;
                      else if (filters.page < 3) pageNum = idx;
                      else if (filters.page > totalPages - 4) pageNum = totalPages - 5 + idx;
                      else pageNum = filters.page - 2 + idx;

                      return (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => setFilters(p => ({ ...p, page: pageNum }))}
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
                    onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
                    disabled={filters.page + 1 >= totalPages || data.length === 0}
                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                  >
                    Sau <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
        </>
      )}
    </PageContainer>
  );
}

function StatTile({ icon, iconClass, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-bo-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{value}</p>
      </div>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        {icon}
      </span>
    </div>
  );
}
