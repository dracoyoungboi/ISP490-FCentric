import { createElement } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dòng thông báo trong màn: nền trắng, viền trái có màu, chỉ biểu tượng có màu (không tô nền xanh/đỏ nhạt).
 * tone: neutral | info | ok | warn | bad.
 */
const KIEU = {
  neutral: { vien: "border-l-slate-300", icon: Info, mau: "text-bo-muted" },
  info: { vien: "border-l-bo-primary", icon: Info, mau: "text-bo-primary" },
  ok: { vien: "border-l-bo-success", icon: CheckCircle2, mau: "text-bo-success" },
  warn: { vien: "border-l-amber-500", icon: AlertTriangle, mau: "text-amber-600" },
  bad: { vien: "border-l-bo-danger", icon: AlertTriangle, mau: "text-bo-danger" },
};

export default function DongThongBao({ tone = "neutral", children, actions, className }) {
  const kieu = KIEU[tone] ?? KIEU.neutral;
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-md border border-l-[3px] border-bo-border bg-white px-3 py-2.5 text-[13px] leading-5 text-bo-foreground",
        kieu.vien,
        className,
      )}
    >
      {createElement(kieu.icon, { className: cn("mt-0.5 size-4 shrink-0", kieu.mau), "aria-hidden": true })}
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">{actions}</div> : null}
    </div>
  );
}

/** Nút dạng chữ đặt trong dòng thông báo (Hoàn tác, Chuyển thành lỗi…). */
export function NutChu({ children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "whitespace-nowrap rounded text-[13px] font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
