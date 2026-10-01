import { cn } from "@/lib/utils";

export default function LoadingState({
  className,
  label = "Đang tải dữ liệu",
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

      <div
        className="size-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
        aria-hidden="true"
      />
    </div>
  );
}