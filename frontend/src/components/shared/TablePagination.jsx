import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Chân bảng phân trang, cùng markup với DonBanHangList / PhieuXuatKhoList. */
export default function TablePagination({
  page,
  size,
  total,
  onPageChange,
  onSizeChange,
  sizeOptions = [10, 20, 50],
  extra,
}) {
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
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-bo-muted">Hiển thị</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-8 w-[110px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
              >
                {size} dòng
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="backoffice-user-menu z-50 w-[110px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
            >
              {sizeOptions.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => onSizeChange(option)}
                  className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                >
                  {option} dòng
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {extra}
      </div>

      <p className="text-xs text-bo-muted">
        Hiển thị <span className="font-semibold text-bo-foreground">{from}</span>
        {" – "}
        <span className="font-semibold text-bo-foreground">{to}</span>
        {" trong tổng số "}
        <span className="font-semibold text-bo-primary">{total}</span> kết quả
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page + 1 >= totalPages}
          className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
        >
          Sau
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
