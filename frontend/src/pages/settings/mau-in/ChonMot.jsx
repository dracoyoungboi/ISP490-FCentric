import { cn } from "@/lib/utils";

/**
 * Nhóm nút chọn một (Khổ giấy, Hướng giấy, Lề, Cỡ chữ, Mã số phiếu) — nền xám nhạt, nút đang
 * chọn nền trắng; trạng thái đọc được bằng trình đọc màn hình (aria-pressed).
 */
export default function ChonMot({ label, options, value, onChange, disabled = false, className }) {
    return (
        <div
            role="group"
            aria-label={label}
            className={cn("inline-flex max-w-full flex-wrap gap-0.5 rounded-md bg-[#eef1f5] p-0.5", className)}
        >
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => {
                            if (!active) onChange(option.value);
                        }}
                        className={cn(
                            "inline-flex h-[30px] min-w-11 items-center justify-center rounded-[5px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary disabled:cursor-not-allowed",
                            active
                                ? "bg-white text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.12)]"
                                : "text-bo-muted hover:text-bo-foreground"
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
