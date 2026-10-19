import { cn } from "@/lib/utils";

/** Kiểu nút và ô nhập dùng chung cho các trang cấu hình (tách khỏi SettingsUI.jsx để file đó chỉ xuất component). */
export const PRIMARY_BUTTON =
  "bg-bo-primary text-white hover:bg-bo-primary-hover disabled:bg-[#c7d6ea] disabled:opacity-100";
export const OUTLINE_BUTTON =
  "border-[#cfd6df] bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";

/** Ô nhập của trang cấu hình: viền đậm hơn ô mặc định để dễ thấy trên nền trắng. */
export function settingsInputClass({ error = false, className } = {}) {
  return cn(
    "h-9 border-[#8a96a6] bg-white text-sm text-bo-foreground shadow-none hover:border-bo-muted",
    "focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15",
    error && "border-bo-danger hover:border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/15",
    className,
  );
}
