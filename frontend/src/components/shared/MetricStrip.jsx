import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MAU_GIA_TRI = {
  danger: "text-red-600",
  warning: "text-amber-700",
  success: "text-emerald-700",
};

// Số cột theo số chỉ số, để hàng cuối không có ô trống
const LUOI = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6",
};

/**
 * Dải chỉ số một khung cho màn theo dõi và báo cáo (bố cục A+G, mục 2.4–2.5 báo cáo review):
 * giữ đủ các chỉ số như trước, chỉ gộp các ô rời thành một khung chia vạch.
 * - items: [{ label, value, hint?, tone? }] — `value` đã định dạng sẵn (chuỗi hoặc node).
 * - loading: hiện khung xương thay cho số (không hiện số 0 giả).
 * Trang danh sách thường KHÔNG dùng dải này: số theo trạng thái nằm trên tab.
 */
export default function MetricStrip({ items, loading = false, label = "Chỉ số", className }) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-bo-border bg-bo-border shadow-sm",
        LUOI[items.length] ?? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col bg-bo-surface px-5 py-4">
          <p className="text-[13px] font-medium text-bo-muted">{item.label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-2/3 bg-slate-100" aria-hidden="true" />
          ) : (
            <p className={cn("mt-1 truncate text-2xl font-semibold tracking-tight text-bo-foreground", MAU_GIA_TRI[item.tone])}>
              {item.value}
            </p>
          )}
          {item.hint ? <p className="mt-0.5 text-xs leading-5 text-bo-muted">{item.hint}</p> : null}
        </div>
      ))}
    </section>
  );
}
