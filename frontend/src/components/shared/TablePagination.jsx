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

  const pageNumbers = dayTrang(page, totalPages);

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
              className="z-50 w-max min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
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

      <nav aria-label="Phân trang" className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="Trang trước"
          title="Trang trước"
          className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers.map((pageNum, idx) =>
            pageNum === null ? (
              <span key={`luoc-${idx}`} aria-hidden="true" className="w-6 text-center text-xs text-bo-muted">
                …
              </span>
            ) : (
              <Button
                key={pageNum}
                variant="ghost"
                onClick={() => onPageChange(pageNum)}
                aria-label={`Trang ${formatNumber(pageNum + 1)}`}
                aria-current={page === pageNum ? "page" : undefined}
                className={
                  page === pageNum
                    ? "h-8 min-w-8 px-2 text-xs tabular-nums bg-bo-primary text-white hover:bg-bo-primary-hover hover:text-white"
                    : "h-8 min-w-8 px-2 text-xs font-normal tabular-nums text-bo-foreground hover:bg-bo-surface-subtle hover:text-bo-foreground"
                }
              >
                {formatNumber(pageNum + 1)}
              </Button>
            ),
          )}
        </div>
        <span className="px-1.5 text-xs text-bo-muted tabular-nums sm:hidden">
          {formatNumber(page + 1)} / {formatNumber(totalPages)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page + 1 >= totalPages}
          aria-label="Trang sau"
          title="Trang sau"
          className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
        >
          <ChevronRight className="size-4" />
        </Button>
      </nav>
    </div>
  );
}

/**
 * Dãy số trang (tính từ 0), `null` là chỗ lược "…". Luôn có trang đầu và trang cuối;
 * quá 7 trang thì luôn đủ 7 ô để dãy nút không co giãn khi chuyển trang.
 */
function dayTrang(page, totalPages) {
  if (totalPages <= 7) return [...Array(totalPages).keys()];
  const last = totalPages - 1;
  if (page <= 3) return [0, 1, 2, 3, 4, null, last];
  if (page >= last - 3) return [0, null, last - 4, last - 3, last - 2, last - 1, last];
  return [0, null, page - 1, page, page + 1, null, last];
}
