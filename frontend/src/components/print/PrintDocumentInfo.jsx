import { cn } from "@/lib/utils";

// Số cột CỐ ĐỊNH, KHÔNG dùng breakpoint (sm:/md:…): breakpoint tính theo
// chiều rộng cửa sổ trình duyệt chứ không theo tờ giấy — khi in khổ A5 vùng
// in chỉ ~470px (< 640px) nên `sm:grid-cols-3` rơi về 2 cột, lệch với bản
// xem trước. Tờ giấy có kích thước cố định nên số cột phải cố định.
const COLUMN_CLASSES = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
};

/**
 * Lưới nhãn/giá trị cho bản in.
 * `items`: [{ label, value, className? }] — `value` có thể là ReactNode
 * (vd: StatusBadge) và được bổ sung "—" khi rỗng.
 * `compact`: layout khổ nhiệt K80 — mỗi trường một dòng label : value.
 * `dense`: khổ A5 — chữ và khoảng cách nhỏ hơn A4.
 */
export default function PrintDocumentInfo({ items, columns = 3, className, compact = false, dense = false }) {
    if (compact) {
        return (
            <div className={cn("divide-y divide-dashed divide-bo-border", className)}>
                {items.map((item, index) => (
                    <div key={item.label || index} className="flex items-start justify-between gap-2 py-1">
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-bo-muted">
                            {item.label}
                        </span>
                        <span className="min-w-0 break-words text-right text-[10px] font-medium leading-snug text-bo-foreground">
                            {item.value ?? "—"}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div
            className={cn(
                dense ? "grid gap-x-4 gap-y-2" : "grid gap-x-6 gap-y-4",
                COLUMN_CLASSES[columns] || COLUMN_CLASSES[3],
                className
            )}
        >
            {items.map((item, index) => (
                <div key={item.label || index} className={cn("min-w-0", item.className)}>
                    <p
                        className={cn(
                            "font-semibold uppercase tracking-wide text-bo-muted",
                            dense ? "text-[9px]" : "text-[10px]"
                        )}
                    >
                        {item.label}
                    </p>
                    <div
                        className={cn(
                            "mt-0.5 break-words font-medium leading-snug text-bo-foreground",
                            dense ? "text-xs" : "text-[13px]"
                        )}
                    >
                        {item.value ?? "—"}
                    </div>
                </div>
            ))}
        </div>
    );
}
