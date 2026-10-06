import { cn } from "@/lib/utils";

/**
 * Bộ chọn zoom DÙNG CHUNG cho các trang preview mẫu in.
 * "Vừa trang" (fit) = thu khớp cả chiều rộng lẫn chiều cao khổ giấy,
 * tối đa 100% — xem computeFitScale trong paperStyles.js.
 *
 * Segmented control GỌN: khung ngoài h-9 (36px) viền mỏng nền nhạt,
 * nút trong h-7 (28px) thụt vào p-[3px]; chọn = nền xanh nhạt + chữ xanh.
 */
const PREVIEW_ZOOM_OPTIONS = [
    { value: "0.5", label: "50%" },
    { value: "0.75", label: "75%" },
    { value: "1", label: "100%" },
    { value: "fit", label: "Vừa trang" },
];

export default function PreviewZoomControl({ value, onChange, className, ariaLabel = "Thu phóng" }) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className={cn(
                "inline-flex items-center gap-0.5 rounded-lg border border-bo-border bg-bo-surface-subtle p-[3px]",
                className
            )}
        >
            {PREVIEW_ZOOM_OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    // Trạng thái truy cập cho lựa chọn hiện tại (aria-pressed) —
                    // KHÔNG dùng title/tooltip vì nút đã có chữ rõ ràng.
                    aria-pressed={value === option.value}
                    className={cn(
                        "inline-flex h-7 items-center rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary",
                        value === option.value
                            ? "bg-bo-primary-soft text-bo-primary"
                            : "text-bo-muted hover:bg-white hover:text-bo-foreground"
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
