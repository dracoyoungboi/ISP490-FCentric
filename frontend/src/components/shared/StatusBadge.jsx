import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  neutral: "border-bo-border bg-slate-100 text-slate-600",
  info: "border-blue-200 bg-bo-primary-soft text-blue-700",
  success: "border-green-200 bg-bo-success-soft text-bo-success",
  warning: "border-orange-200 bg-bo-warning-soft text-bo-warning",
  danger: "border-red-200 bg-bo-danger-soft text-bo-danger",
};

export default function StatusBadge({
  label,
  tone = "neutral",
  dot = true,
  className,
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        TONE_CLASSES[tone] || TONE_CLASSES.neutral,
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {label}
    </span>
  );
}
