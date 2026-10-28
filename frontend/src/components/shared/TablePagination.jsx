import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CapNhatLuc from "@/components/shared/CapNhatLuc";
import { LUA_CHON_SO_DONG } from "@/constants/phanTrang";
import { formatNumber } from "@/utils/formatters";

/**
 * Chân bảng phân trang dùng chung. `page` tính từ 0.
 * Truyền vào `footer` của TableShell; khi không có dòng nào thì trang tự ẩn (không truyền footer).
 * Bảng phân trang theo đơn vị khác dòng (vd. theo sản phẩm) thì đổi `sizeLabel`, `totalLabel`;
 * `totalNote` ghi thêm sau tổng số (vd. "49 SKU").
 * `sizeMenuTitle` / `sizeMenuNote` (tùy chọn): tiêu đề và một dòng giải thích trong menu số dòng, khi đơn vị dễ hiểu nhầm.
 *
 * `capNhat` (kết quả của useTaiLaiDanhSach): thêm "Cập nhật lúc HH:mm" + nút ⟳ cạnh dòng tổng số (PA1).
 * Khi có `capNhat`, trang truyền footer cả lúc danh sách trống: chân bảng chỉ còn phần cập nhật,
 * vì danh sách trống chính là lúc người dùng chờ dữ liệu mới.
 */
export default function TablePagination({
  page,
  size,
  total,
  onPageChange,
  onSizeChange,
  sizeOptions = LUA_CHON_SO_DONG,
  sizeLabel = "dòng",
  totalLabel = "kết quả",
  totalNote,
  sizeMenuTitle,
  sizeMenuNote,
  extra,
  capNhat,
}) {
  if (capNhat && total === 0) {
    return (
      <div className="flex justify-center">
        <CapNhatLuc {...capNhat} />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, total);

  const pageNumbers = [...Array(Math.min(5, totalPages))].map((_, idx) => {
    if (totalPages <= 5 || page < 3) return idx;
    if (page > totalPages - 4) return totalPages - 5 + idx;
    return page - 2 + idx;
  });

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        {onSizeChange ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                aria-label={`Số ${sizeLabel} mỗi trang`}
                className="h-8 w-auto min-w-[110px] justify-between border-bo-border bg-bo-surface px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
              >
                {size} {sizeLabel}
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="z-50 w-max min-w-[8rem] rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
            >
              {sizeMenuTitle ? (
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{sizeMenuTitle}</p>
              ) : null}
              {sizeOptions.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => onSizeChange(option)}
                  className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                >
                  {option} {sizeLabel}
                </DropdownMenuItem>
              ))}
              {sizeMenuNote ? (
                <p className="mt-1 max-w-[15rem] border-t border-bo-border px-2.5 pb-1 pt-2 text-[11.5px] leading-4 text-bo-muted">
                  {sizeMenuNote}
                </p>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {extra}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs text-bo-muted tabular-nums">
          Hiển thị <span className="font-semibold text-bo-foreground">{formatNumber(from)}</span>
          {" – "}
          <span className="font-semibold text-bo-foreground">{formatNumber(to)}</span>
          {" trong tổng số "}
          <span className="font-semibold text-bo-primary">{formatNumber(total)}</span> {totalLabel}
          {totalNote ? <> · {totalNote}</> : null}
        </p>
        {capNhat ? (
          <>
            <span aria-hidden="true" className="hidden h-4 w-px bg-bo-border sm:block" />
            <CapNhatLuc {...capNhat} />
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="h-8 gap-1 border-bo-border bg-bo-surface px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
        >
          <ChevronLeft className="size-3.5" />
          Trước
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers.map((pageNum) => (
            <Button
              key={pageNum}
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pageNum)}
              aria-current={page === pageNum ? "page" : undefined}
              className={
                page === pageNum
                  ? "h-8 border-bo-primary bg-bo-primary px-2.5 text-xs text-white hover:bg-bo-primary-hover"
                  : "h-8 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle"
              }
            >
              {pageNum + 1}
            </Button>
          ))}
        </div>
        <span className="text-xs text-bo-muted tabular-nums sm:hidden">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page + 1 >= totalPages}
          className="h-8 gap-1 border-bo-border bg-bo-surface px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
        >
          Sau
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
