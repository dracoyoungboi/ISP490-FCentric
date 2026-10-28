import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Ô type="search": Chrome / Edge / Safari tự vẽ thêm nút × khi có chữ. Ẩn nút đó để chỉ còn nút × của ô này
// (nút của ô này gọi onClear và đọc được bằng trình đọc màn hình).
export default function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Tìm kiếm...",
  label = "Tìm kiếm",
  className,
  ...props
}) {
  return (
    <label className={cn("relative block w-full sm:max-w-sm", className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-bo-border bg-bo-surface py-2 pr-9 pl-9 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 [&::-webkit-search-cancel-button]:appearance-none"
        {...props}
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-bo-muted hover:bg-slate-100 hover:text-bo-foreground"
          aria-label="Xóa từ khóa tìm kiếm"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </label>
  );
}
