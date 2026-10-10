import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Một bước thiết lập (sao chép từ PaymentSettingsPage.jsx, thêm trạng thái đang làm). */
export default function SetupStep({ index, done, active = false, onClick, children }) {
  const content = (
    <>
      {done ? (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-bo-success text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      ) : (
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
            active
              ? "border-bo-primary bg-bo-primary text-white"
              : "border-slate-300 bg-bo-surface text-slate-700",
          )}
        >
          {index}
        </span>
      )}
      <span
        className={cn(
          "text-sm",
          active ? "font-semibold text-bo-primary" : done ? "text-slate-600" : "font-medium text-bo-foreground",
        )}
      >
        {children}
        {done ? <span className="sr-only"> (đã xong)</span> : null}
      </span>
    </>
  );

  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-current={active ? "step" : undefined}
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-2.5">{content}</div>
      )}
    </li>
  );
}
