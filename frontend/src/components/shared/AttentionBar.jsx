import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const KIEU = {
  warning: { khung: "border-orange-200 bg-orange-50 text-orange-950", icon: "text-orange-600", nut: "text-orange-700 hover:text-orange-800", Icon: AlertTriangle },
  danger: { khung: "border-red-200 bg-red-50 text-red-950", icon: "text-red-600", nut: "text-red-700 hover:text-red-800", Icon: AlertTriangle },
  info: { khung: "border-bo-border bg-bo-surface-subtle text-bo-foreground", icon: "text-bo-muted", nut: "text-bo-primary hover:text-bo-primary-hover", Icon: Info },
};

/**
 * Dòng chú ý của trang danh sách (bố cục A+G, quy tắc R4):
 * chỉ render khi `count` > 0; người gọi chỉ truyền cho vai trò xử lý được việc này,
 * dùng đúng điều kiện của "Việc cần xử lý" ở Tổng quan; nút dẫn tới đúng tab.
 * Điện thoại (dưới 640 px): nút xuống hàng dưới chữ, thẳng lề với chữ, cao 44 px cho dễ chạm; màn rộng nút nằm cuối hàng.
 */
export default function AttentionBar({ count, children, actionLabel, onAction, tone = "warning", className }) {
  if (!(count > 0)) return null;
  const kieu = KIEU[tone] ?? KIEU.warning;
  const { Icon } = kieu;
  return (
    <div
      role="status"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-sm max-sm:items-start max-sm:gap-y-0 max-sm:pb-0", kieu.khung, className)}
    >
      {/* Điện thoại: biểu tượng thẳng dòng chữ đầu (chữ có thể dài vài dòng) */}
      <Icon className={cn("size-4 shrink-0 max-sm:mt-0.5", kieu.icon)} aria-hidden="true" />
      <p className={cn("min-w-0 flex-1", !(actionLabel && onAction) && "max-sm:pb-2.5")}>{children}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            "max-sm:ml-7 max-sm:min-h-11 max-sm:basis-full",
            kieu.nut,
          )}
        >
          {actionLabel}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
