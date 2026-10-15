import { createElement } from "react";
import { cn } from "@/lib/utils";

/**
 * Cột "Thao tác" chuẩn của trang danh sách: các ô vuông 32px viền xám, icon xám,
 * rê chuột đổi màu xanh (nút xóa đổi màu đỏ). Ô tiêu đề cột ghi "Thao tác", căn giữa.
 *
 * <RowActions>
 *   <RowActionButton icon={Eye} label="Xem chi tiết" onClick={...} />
 *   <RowActionButton icon={Pencil} label="Chỉnh sửa" onClick={...} />
 *   <RowActionButton icon={Trash2} label="Xóa" tone="danger" onClick={...} />
 * </RowActions>
 *
 * Bấm nút không làm bấm theo cả dòng (dòng có onClick mở chi tiết), kể cả khi nút đang khóa
 * (nút khóa vẫn nhận chuột để chặn cú bấm và hiện chú thích `label`).
 */
export function RowActions({ children, className }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      {children}
    </div>
  );
}

const BASE =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const TONE = {
  default: "hover:border-bo-primary hover:text-bo-primary",
  danger: "hover:border-bo-danger hover:text-bo-danger",
  /** Việc đang chờ (ví dụ "Lưu giá" khi có thay đổi chưa lưu): luôn tô xanh lá để dễ thấy. */
  success: "border-bo-success text-bo-success hover:bg-bo-success-soft",
};

/** label: hiện khi rê chuột và đọc cho trình đọc màn hình (bắt buộc vì nút chỉ có icon). */
export function RowActionButton({
  icon,
  label,
  onClick,
  tone = "default",
  disabled = false,
  className,
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      className={cn(BASE, TONE[tone] ?? TONE.default, className)}
    >
      {createElement(icon, { className: "size-4", "aria-hidden": true })}
    </button>
  );
}

export default RowActions;
