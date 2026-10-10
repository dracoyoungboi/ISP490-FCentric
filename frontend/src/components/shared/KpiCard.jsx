import { cn } from "@/lib/utils";

/**
 * Ô thống kê dùng chung (sao chép từ KpiCard của pages/bao-cao/BaoCaoDoanhThu.jsx,
 * cùng giao diện StatTile ở các trang danh sách). Trang cũ giữ bản cục bộ của mình.
 */
export default function KpiCard({ icon, label, value, sub, iconClass, valueClass, className, onClick, title }) {
  const Root = onClick ? "button" : "div";
  return (
    <Root
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-lg border border-bo-border bg-bo-surface p-4 text-left shadow-sm",
        onClick && "w-full transition-colors hover:border-bo-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-bo-muted">{label}</p>
          <p className={cn("mt-1 truncate text-2xl font-bold tracking-tight text-bo-foreground", valueClass)}>
            {value}
          </p>
          {sub ? <p className="mt-1 text-xs text-bo-muted">{sub}</p> : null}
        </div>
        {icon ? (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", iconClass)}>
            {icon}
          </span>
        ) : null}
      </div>
    </Root>
  );
}
