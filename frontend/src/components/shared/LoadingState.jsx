import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export default function LoadingState({
  className,
  label = t("Đang tải dữ liệu"),
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "flex min-h-[50vh] w-full items-center justify-center",
        className
      )}
    >
      <span className="sr-only">{label}</span>

      <div className="bo-vong-tai" aria-hidden="true" />
    </div>
  );
}