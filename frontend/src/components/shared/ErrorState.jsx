import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ErrorState({
  title = "Không thể tải dữ liệu",
  description = "Đã xảy ra lỗi. Vui lòng thử lại.",
  onRetry,
  className,
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-bo-danger-soft text-bo-danger">
        <AlertCircle className="size-5" />
      </span>
      <h3 className="text-sm font-semibold text-bo-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-bo-muted">
        {description}
      </p>
      {onRetry ? (
        <Button
          variant="outline"
          className="mt-4 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
          onClick={onRetry}
        >
          <RefreshCcw />
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
