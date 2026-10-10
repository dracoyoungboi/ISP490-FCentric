import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Kết quả một thao tác ngay tại chỗ (gộp InlineSuccess + InlineError của PaymentSettingsPage.jsx).
 * result = { ok, title, message } hoặc null.
 */
export default function InlineResult({ result, className }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border border-green-200 bg-bo-success-soft px-3 py-2.5 text-sm text-bo-success",
          className,
        )}
        role="status"
      >
        <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
        <p className="min-w-0 break-words">
          <strong className="font-semibold">{result.title}</strong>
          {result.message ? <span className="block text-slate-700">{result.message}</span> : null}
        </p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-red-200 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger",
        className,
      )}
      role="alert"
    >
      <XCircle className="mt-0.5 shrink-0" size={16} />
      <p className="min-w-0 break-words">
        <strong className="font-semibold">{result.title}</strong>
        {result.message ? <span className="block text-slate-700">{result.message}</span> : null}
      </p>
    </div>
  );
}
