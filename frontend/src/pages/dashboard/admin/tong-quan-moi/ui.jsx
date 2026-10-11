import { createElement, useId } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, RefreshCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MAU2 } from "./mau";

/*
 * Bộ khung giao diện của màn Tổng quan (bản đề xuất).
 * Thang chữ cố định: 12 / 13 / 14 / 15 / 20 / 28px. Bo góc 12px cho thẻ, 6–8px cho phần tử trong thẻ.
 * Thẻ chỉ có viền mảnh, không đổ bóng, không dòng mô tả: kỳ xem và kho đã nằm ở thanh lọc phía trên.
 */

export function Card({ title, right, children, className, bodyClassName, loading, error, onRetry, empty, emptyIcon, emptyText, as = "section", labelId }) {
  const autoId = useId();
  const id = labelId ?? `${autoId}-t`;
  let body = children;
  if (loading) body = <CardSkeleton />;
  else if (error) body = <CardError onRetry={onRetry} />;
  else if (empty) body = <CardEmpty icon={emptyIcon} text={emptyText} />;
  return createElement(
    as,
    {
      "aria-labelledby": title ? id : undefined,
      "aria-busy": loading || undefined,
      className: cn("flex min-w-0 flex-col rounded-xl border border-[#e6e9ef] bg-white", className),
    },
    <>
      {title ? (
        <header className="flex min-h-[52px] items-center justify-between gap-3 px-5 pt-4">
          <h2 id={id} className="truncate text-[15px] font-semibold leading-6 text-bo-foreground">
            {title}
          </h2>
          {right && !loading ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
        </header>
      ) : null}
      <div className={cn("flex min-w-0 flex-1 flex-col px-5 pb-5 pt-3", bodyClassName)}>{body}</div>
    </>,
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-5 w-1/3 bg-slate-100" />
      <Skeleton className="min-h-24 flex-1 bg-slate-100" />
    </div>
  );
}

function CardError({ onRetry }) {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      <AlertTriangle className="size-5 text-bo-warning" aria-hidden="true" />
      <p className="text-sm font-medium text-bo-foreground">Không tải được số liệu</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e6e9ef] px-3 text-[13px] font-medium text-bo-foreground hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
        >
          <RefreshCcw className="size-3.5" aria-hidden="true" />
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

function CardEmpty({ icon, text }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      {icon ? createElement(icon, { className: "size-5 text-slate-400", "aria-hidden": true }) : null}
      <p className="max-w-xs text-[13px] leading-5 text-bo-muted">{text}</p>
    </div>
  );
}

export function MoreLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-0.5 whitespace-nowrap rounded text-[13px] font-medium text-bo-muted hover:text-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
    >
      {children}
      <ChevronRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

/** Thay đổi so với kỳ trước: mũi tên + số, xanh khi tăng, đỏ khi giảm. Không nền, để không lấn số chính. */
export function Delta({ value, text, goodWhenUp = true, className }) {
  const coSo = value != null && Number.isFinite(value);
  const phang = !coSo || Math.abs(value) < 0.05;
  const tang = coSo && value > 0;
  const tot = goodWhenUp ? tang : !tang;
  const noiDung =
    text ?? (coSo ? `${new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(value))}%` : "—");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold tabular-nums",
        phang ? "text-bo-muted" : tot ? "text-[#15803d]" : "text-[#dc2626]",
        className,
      )}
    >
      {!phang ? createElement(tang ? ArrowUp : ArrowDown, { className: "size-3", strokeWidth: 2.5, "aria-hidden": true }) : null}
      <span className="sr-only">{!coSo ? "Chưa có số so sánh " : phang ? "Không đổi " : tang ? "Tăng " : "Giảm "}</span>
      {noiDung}
    </span>
  );
}

/** Nhóm nút chuyển (tab nhỏ trong thẻ). */
export function Segmented({ value, onChange, options, label, size = "sm" }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium text-bo-muted transition-colors hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-8 px-3 text-[13px]",
            value === o.value && "bg-white text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]",
          )}
        >
          {o.label}
          {o.badge != null ? (
            <span className={cn("rounded px-1 text-[11px] font-semibold tabular-nums", o.badgeTone === "bad" ? "bg-red-50 text-red-600" : "bg-slate-200/70 text-bo-muted")}>
              {o.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Nhãn tình trạng: chấm màu + chữ, nền rất nhạt. */
export function StatusChip({ tone, children }) {
  const tones = {
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700",
    neutral: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium", tones[tone])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Đường xu hướng nhỏ: nét 1.75px, vùng tô 10%. */
export function Sparkline({ values, color = MAU2.chinh, className }) {
  const gid = useId();
  const n = values.length;
  if (n < 2) return <div className={cn("h-8", className)} aria-hidden="true" />;
  const max = Math.max(...values, 1);
  const W = 120;
  const H = 32;
  const pts = values.map((v, i) => [(i / (n - 1)) * W, H - 2 - (Math.max(v, 0) / max) * (H - 6)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("h-8 w-full overflow-visible", className)} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Thanh chia phần, các đoạn cách nhau 2px. */
export function StackBar({ segments, className, height = "h-2" }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <div className={cn("flex gap-[2px] overflow-hidden rounded-full", height, className)} aria-hidden="true">
      {total > 0 ? (
        segments.map((s) =>
          s.value > 0 ? (
            <span key={s.key} className="block h-full min-w-[4px] first:rounded-l-full last:rounded-r-full" style={{ flexGrow: s.value, background: s.color }} />
          ) : null,
        )
      ) : (
        <span className="block h-full w-full bg-slate-100" />
      )}
    </div>
  );
}
