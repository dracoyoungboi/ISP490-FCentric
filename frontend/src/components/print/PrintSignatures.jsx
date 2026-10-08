import { cn } from "@/lib/utils";

/**
 * Khối ký tên cho bản in — chỉ hiển thị họ tên/email từ dữ liệu thật,
 * chừa khoảng trống để ký tay (không có chữ ký giả).
 * Khối có `name` rỗng là ô ký TRỐNG (vd. "Người nhận", "Người giao" — người
 * ngoài hệ thống ký và ghi rõ họ tên khi nhận/giao hàng): giữ nguyên dòng
 * tên bằng khoảng trắng để chân ký thẳng hàng với khối bên cạnh.
 * `compact`: layout khổ nhiệt K80 — xếp dọc, thu gọn.
 */
export default function PrintSignatures({ left, right, compact = false }) {
    const blocks = [left, right].filter(Boolean);

    if (blocks.length === 0) return null;

    return (
        <div
            className={cn(
                "print-signatures",
                compact
                    ? "mt-4 grid grid-cols-1 gap-4"
                    : "mt-10 grid gap-16",
                !compact && blocks.length === 1 ? "grid-cols-1" : !compact ? "grid-cols-2" : ""
            )}
        >
            {blocks.map((block) => (
                <div
                    key={block.label}
                    className={!compact && blocks.length === 1 ? "mx-auto w-48 text-center" : "text-center"}
                >
                    <p
                        className={cn(
                            "font-semibold uppercase tracking-wide text-bo-muted",
                            compact ? "text-[9px]" : "text-[11px]"
                        )}
                    >
                        {block.label}
                    </p>
                    {/* Khoảng trống để ký tay */}
                    <div className={compact ? "mx-auto mt-4 h-10 w-32" : "mx-auto mt-10 h-14 w-48"} />
                    <p className={cn("font-bold text-bo-foreground", compact ? "text-[11px]" : "text-sm")}>
                        {block.name || "\u00A0"}
                    </p>
                    {block.email && block.email !== "—" ? (
                        <p className={cn("mt-0.5 text-bo-muted", compact ? "text-[9px]" : "text-xs")}>
                            {block.email}
                        </p>
                    ) : null}
                    <p className={cn("mt-0.5 italic text-bo-muted", compact ? "text-[8px]" : "text-xs")}>
                        (Ký, ghi rõ họ tên)
                    </p>
                </div>
            ))}
        </div>
    );
}
