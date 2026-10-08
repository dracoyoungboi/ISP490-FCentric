import { cn } from "@/lib/utils";

/**
 * Khối đề mục trong bản in: tiêu đề chữ hoa + đường kẻ nhẹ.
 * `dense`: khổ A5 — khoảng cách gọn hơn A4 để phiếu ít dòng vừa một trang.
 * `keepTogether`: không cắt đôi khối khi sang trang (khối thông tin ngắn);
 * tiêu đề luôn đi cùng nội dung ngay sau nó (print.css).
 */
export default function PrintSection({
    title,
    children,
    className,
    accentColor,
    compact = false,
    dense = false,
    keepTogether = false,
}) {
    return (
        <section
            className={cn(
                compact ? "mt-3" : dense ? "mt-2.5" : "mt-5",
                keepTogether && "print-keep-together",
                className
            )}
        >
            {title ? (
                <h3
                    className={cn(
                        "print-section-title border-b border-bo-border font-semibold uppercase tracking-wide text-bo-primary",
                        compact ? "mb-2 pb-1.5 text-[10px]" : dense ? "mb-1 pb-0.5 text-[10px]" : "mb-2 pb-1.5 text-xs"
                    )}
                    style={accentColor ? { color: accentColor } : undefined}
                >
                    {title}
                </h3>
            ) : null}
            {children}
        </section>
    );
}
