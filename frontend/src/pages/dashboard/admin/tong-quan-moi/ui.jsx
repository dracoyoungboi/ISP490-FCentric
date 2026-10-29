import { createElement, useId } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, RefreshCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Khung giao diện của màn Tổng quan (bản Kiểu 3).
 * Thẻ: viền 1px, bo 8px, bóng rất nhẹ; đầu thẻ cao 52px có vạch ngăn, tiêu đề 16px.
 * Phạm vi cạnh tiêu đề chỉ ghi khi khối khác kỳ ở đầu trang (Tồn kho "Hiện tại"). Khối không ghi phạm vi là số của kỳ đang xem:
 * kỳ, khoảng ngày và giờ số liệu chỉ ghi một lần ở đầu trang (mỗi thông tin một chỗ, quyết định 19/10/2026).
 * Thẻ là container (@container) để bên trong tự xếp lại theo bề rộng thẻ, không theo bề rộng màn hình.
 */

export const THE = "@container flex min-w-0 flex-col rounded-lg border border-bo-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

/** Lề ngang bên trong thẻ: 20px, thẻ hẹp (≤ 520px) còn 16px. */
export const LE = "px-5 @max-[520px]:px-4";

export function Card({ id, title, scope, scopeClassName, right, children, className, bodyClassName, loading, error, onRetry, empty, emptyIcon, emptyText, labelId }) {
  const autoId = useId();
  const tieuDeId = labelId ?? `${autoId}-t`;
  let body = children;
  if (loading) body = <CardSkeleton />;
  else if (error) body = <CardError onRetry={onRetry} />;
  else if (empty) body = <CardEmpty icon={emptyIcon} text={emptyText} />;
  return (
    <section id={id} aria-labelledby={title ? tieuDeId : undefined} aria-busy={loading || undefined} className={cn(THE, className)}>
      {title ? (
        <header className={cn("flex min-h-[52px] items-center gap-2 border-b border-[#eef1f5]", LE)}>
          <h2 id={tieuDeId} className="min-w-0 truncate text-base font-semibold leading-6 text-bo-foreground">
            {title}
          </h2>
          {scope ? <span className={cn("min-w-0 truncate whitespace-nowrap text-sm text-bo-muted", scopeClassName)}>{scope}</span> : null}
          {right && !loading ? <div className="ml-auto flex shrink-0 items-center gap-3">{right}</div> : null}
        </header>
      ) : null}
      <div className={cn("flex min-w-0 flex-1 flex-col", (loading || error || empty) && cn(LE, "py-4"), !(loading || error || empty) && bodyClassName)}>{body}</div>
    </section>
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

export function CardError({ onRetry, text = "Không tải được số liệu" }) {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      <AlertTriangle className="size-5 text-bo-warning" aria-hidden="true" />
      <p className="text-sm font-medium text-bo-foreground">{text}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-bo-border px-3 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
        >
          <RefreshCcw className="size-3.5" aria-hidden="true" />
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

export function CardEmpty({ icon, text }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      {icon ? createElement(icon, { className: "size-5 text-slate-400", "aria-hidden": true }) : null}
      <p className="max-w-xs text-[13px] leading-5 text-bo-muted">{text}</p>
    </div>
  );
}

/** Liên kết "Xem …" ở đầu thẻ: chữ xanh, mũi tên phải. Muốn ẩn chữ trên thẻ hẹp thì bọc chữ trong span có lớp ẩn. */
export function MoreLink({ to, children, className, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap rounded text-sm font-medium text-bo-primary hover:text-bo-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
        className,
      )}
    >
      {children}
      <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}

/** Mức thay đổi so với kỳ trước, có dấu: "+12,4%" xanh, "−3,1%" đỏ, "0%" xám. `bd` lấy từ bienDong(); null thì không vẽ. */
export function Delta({ bd, className }) {
  if (!bd) return null;
  return (
    <span className={cn("whitespace-nowrap font-semibold tabular-nums", bd.tang == null ? "text-bo-muted" : bd.tang ? "text-[#15803d]" : "text-[#b42318]", className)}>
      <span className="sr-only">{bd.tang == null ? "Không đổi " : bd.tang ? "Tăng " : "Giảm "}</span>
      {bd.chu}
    </span>
  );
}

/** Thanh chia phần, các đoạn cách nhau 2px (khoảng trắng tách màu, không viền). */
export function StackBar({ segments, className, height = "h-3", label }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <div className={cn("flex gap-[2px]", height, className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {total > 0 ? (
        segments.map((s) =>
          s.value > 0 ? <span key={s.key} className="block h-full min-w-[3px] rounded-[3px]" style={{ flexGrow: s.value, flexBasis: 0, background: s.color }} /> : null,
        )
      ) : (
        <span className="block h-full w-full rounded-[3px] bg-slate-100" />
      )}
    </div>
  );
}

/** Khung chờ cho một dòng số trong thẻ. */
export function DongCho({ className }) {
  return <Skeleton className={cn("h-4 bg-slate-100", className)} />;
}
