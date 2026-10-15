import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const SWITCH_CLASS = "data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 [&>span]:bg-white";
export const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-bo-border bg-white px-3 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";

/**
 * Khung cấu hình 2 cột trong một thẻ trắng: bên trái tiêu đề và mô tả ngắn,
 * bên phải các khối tùy chọn. Màn hẹp thì xếp chồng.
 */
export function SettingsCard({ title, description, children, className }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-lg border border-bo-border bg-white shadow-sm", className)}
    >
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10 lg:p-6">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold text-bo-foreground">
            {title}
          </h2>
          {description ? <div className="mt-1.5 space-y-2 text-sm leading-6 text-bo-muted">{description}</div> : null}
        </div>
        <div className="min-w-0 space-y-3">{children}</div>
      </div>
    </section>
  );
}

/**
 * Một khối tùy chọn trong SettingsCard. Có `onCheckedChange` thì hiện công tắc bật/tắt trước tiêu đề;
 * `children` là phần chi tiết (ô nhập, ghi chú) bên dưới, chỉ hiện khi khối đang bật (hoặc khối không có công tắc).
 */
export function SettingOption({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  children,
  showChildrenWhenOff = false,
  className,
}) {
  const id = useId();
  const coCongTac = typeof onCheckedChange === "function";
  const hienChiTiet = children && (!coCongTac || checked || showChildrenWhenOff);
  return (
    <div className={cn("rounded-lg border border-bo-border bg-white p-4", className)}>
      <div className="flex items-start gap-3">
        {coCongTac ? (
          <Switch
            id={id}
            checked={Boolean(checked)}
            disabled={disabled}
            onCheckedChange={onCheckedChange}
            aria-describedby={description ? `${id}-mo-ta` : undefined}
            className={cn(SWITCH_CLASS, "mt-0.5")}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {coCongTac ? (
            <label htmlFor={id} className="cursor-pointer text-sm font-medium text-bo-foreground">
              {title}
            </label>
          ) : (
            <p className="text-sm font-medium text-bo-foreground">{title}</p>
          )}
          {description ? (
            <div id={`${id}-mo-ta`} className="mt-1 text-sm leading-6 text-bo-muted">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      {hienChiTiet ? (
        <div className={cn("mt-4 border-t border-bo-border pt-4", coCongTac && "sm:ml-12")}>{children}</div>
      ) : null}
    </div>
  );
}

/** Một dòng "nhãn — giá trị" trong khối thông tin (nhãn chữ thường màu xám, không in hoa). */
export function InfoRow({ label, children, className }) {
  return (
    <div className={cn("flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4", className)}>
      <dt className="shrink-0 text-sm text-bo-muted sm:w-48">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-bo-foreground">{children}</dd>
    </div>
  );
}

/** Ô nhập số nguyên có đơn vị, dùng cho quy tắc tồn kho. */
export function NumberField({ label, unit, value, onChange, min, max, error, hint, disabled }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-bo-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          step={1}
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-ghi-chu` : undefined}
          className={cn(
            INPUT_CLASS,
            "tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            unit && "pr-12",
            error && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15",
          )}
        />
        {unit ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-bo-muted">{unit}</span>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-ghi-chu`} className="mt-1 text-xs text-bo-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-ghi-chu`} className="mt-1 text-xs leading-5 text-bo-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
