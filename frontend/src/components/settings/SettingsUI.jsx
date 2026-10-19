import { ChevronRight, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OUTLINE_BUTTON, PRIMARY_BUTTON } from "./settingsStyles";

/**
 * Khối giao diện dùng chung của trung tâm Cấu hình (kiểu trang Cấu hình của Sapo):
 * thẻ trắng không viền, bóng nhẹ; mỗi thẻ sửa và lưu riêng (đang sửa thì viền xanh).
 */

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.08)]";
const CARD_EDITING = "shadow-[0_0_0_1px_var(--color-bo-primary),0_0_0_4px_rgba(22,119,255,0.12)]";

/** Thẻ của một mục. `as="form"` cho thẻ có ô nhập (Enter để lưu). */
export function SettingsCard({ as = "section", editing = false, className, children, ...props }) {
  const Tag = as;
  return (
    <Tag
      className={cn("rounded-lg bg-bo-surface transition-shadow", editing ? CARD_EDITING : CARD_SHADOW, className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** Đầu thẻ: tiêu đề 16px, chú thích nhỏ, thao tác bên phải (thường là nút Sửa). */
export function SettingsCardHeader({ title, note, action, titleId }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-[18px] pb-1.5">
      <div className="min-w-0">
        <h2 id={titleId} className="text-base leading-6 font-semibold text-bo-foreground">{title}</h2>
        {note ? <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{note}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Nút chữ xanh (Sửa, Cập nhật, Đăng ký lại…). */
export function SettingsTextButton({ className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "-mr-2.5 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-bo-primary",
        "hover:bg-bo-primary-soft hover:text-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary",
        "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-400",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SettingsEditButton({ label = "Sửa", ...props }) {
  return (
    <SettingsTextButton {...props}>
      <Pencil className="size-[15px]" aria-hidden="true" />
      {label}
    </SettingsTextButton>
  );
}

/** Hàng Hủy / Lưu ở chân thẻ đang sửa. */
export function SettingsFormActions({ onCancel, saving = false, disabled = false, saveLabel = "Lưu", className }) {
  return (
    <div className={cn("mt-1 flex justify-end gap-2 border-t border-[#eef1f5] px-5 py-3", className)}>
      <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={onCancel} disabled={saving}>
        Hủy
      </Button>
      <Button type="submit" className={PRIMARY_BUTTON} disabled={disabled || saving}>
        {saving ? "Đang lưu…" : saveLabel}
      </Button>
    </div>
  );
}

/** Liên kết "liên quan" ở chân thẻ chính (ẩn khi đang sửa). */
export function SettingsFooterLink({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-b-lg border-t border-[#eef1f5] px-5 py-3.5 text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
    >
      {Icon ? <Icon className="size-[18px] shrink-0 text-[#7a8594]" aria-hidden="true" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-5 font-medium">{title}</span>
        {description ? <span className="block text-[13px] leading-5 text-[#5b6676]">{description}</span> : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[#7a8594]" aria-hidden="true" />
    </Link>
  );
}

/** Nhãn nhóm con trong một thẻ (chữ nhỏ in hoa). */
export function SettingsGroupLabel({ id, children, className }) {
  return (
    <p id={id} className={cn("pt-3 pb-1 text-[11px] leading-4 font-semibold tracking-[0.05em] text-[#8a94a3] uppercase", className)}>
      {children}
    </p>
  );
}

const PILL_TONE = {
  ok: "bg-bo-success-soft text-bo-success",
  off: "bg-slate-100 text-slate-600",
  warn: "bg-bo-warning-soft text-bo-warning",
};

/** Nhãn trạng thái nhỏ (Mặc định, Đã kết nối…). */
export function SettingsPill({ tone = "off", children }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-[3px] px-1.5 text-xs leading-4 font-semibold whitespace-nowrap", PILL_TONE[tone])}>
      {children}
    </span>
  );
}

/** Dòng gợi ý / lỗi ngay dưới ô nhập. */
export function SettingsFieldHint({ id, error, children, className }) {
  return (
    <p id={id} role={error ? "alert" : undefined} className={cn("text-xs leading-4", error ? "text-red-700" : "text-[#7a8594]", className)}>
      {error || children}
    </p>
  );
}
