import { createElement } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export default function EmptyState({
  title = t("Chưa có dữ liệu"),
  description = t("Dữ liệu sẽ xuất hiện tại đây khi được tạo."),
  icon = Inbox,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-bo-primary-soft text-bo-primary">
        {createElement(icon, { className: "size-5" })}
      </span>
      <h3 className="text-sm font-semibold text-bo-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-bo-muted">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
