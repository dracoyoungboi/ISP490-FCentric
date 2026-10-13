import { Filter } from "lucide-react";

/** Khung "Bộ lọc tìm kiếm" như các trang danh sách hiện có; con là FilterBar. */
export default function FilterPanel({ title = "Bộ lọc tìm kiếm", children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-bo-border px-4 py-3 sm:px-5">
        <Filter className="size-4 text-bo-primary" />
        <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">{title}</h2>
      </div>
      {children}
    </div>
  );
}
