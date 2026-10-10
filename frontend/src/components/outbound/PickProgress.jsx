import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatQuantity, toNumber } from "@/constants/outbound";

/** Tiến độ nhặt: thanh + "đã quét / cần nhặt (x%)". */
export default function PickProgress({ daQuet, canNhat, percent, compact = false, className }) {
  const total = toNumber(canNhat);
  const done = toNumber(daQuet);
  const pct = percent !== undefined && percent !== null
    ? Math.min(100, Math.max(0, toNumber(percent)))
    : total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const complete = total > 0 && done >= total;

  return (
    <div className={cn("min-w-0", className)}>
      <Progress
        value={pct}
        aria-label="Tiến độ nhặt hàng"
        className={cn(
          "bg-slate-100",
          compact ? "h-1.5" : "h-2",
          complete ? "[&_[data-slot=progress-indicator]]:bg-bo-success" : "[&_[data-slot=progress-indicator]]:bg-bo-primary",
        )}
      />
      <p className={cn("mt-1 text-xs text-bo-muted", compact ? "" : "sm:text-sm")}>
        <span className={cn("font-semibold", complete ? "text-bo-success" : "text-bo-foreground")}>
          {formatQuantity(done)}
        </span>
        /{formatQuantity(total)} sản phẩm · {Math.round(pct)}%
      </p>
    </div>
  );
}
