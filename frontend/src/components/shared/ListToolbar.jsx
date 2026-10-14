import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Hàng đầu khung bảng của trang danh sách (bố cục A+G): tab trạng thái bên trái,
 * tìm kiếm và bộ lọc bên phải. Không đủ chỗ thì bộ lọc lên dòng trên, tab ở dòng dưới
 * (flex-wrap-reverse) để gạch chân tab luôn nằm sát mép bảng.
 * Truyền vào `toolbar` của TableShell.
 * - onClear: hiện nút "Xóa lọc" khi `hasFilter` (chỉ khi đang lọc).
 */
export default function ListToolbar({ tabs, children, hasFilter = false, onClear, className }) {
  return (
    <div className={cn("flex flex-wrap-reverse items-center gap-x-3 border-b border-bo-border px-3 sm:px-4", className)}>
      {tabs ? <div className="min-w-0 max-w-full">{tabs}</div> : null}
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 py-2 sm:w-auto">
        {children}
        {hasFilter && onClear ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-9 gap-1.5 px-2.5 text-sm font-normal text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground"
          >
            <X className="size-4" />
            Xóa lọc
          </Button>
        ) : null}
      </div>
    </div>
  );
}
