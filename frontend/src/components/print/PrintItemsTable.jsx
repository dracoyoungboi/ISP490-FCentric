import { cn } from "@/lib/utils";

/**
 * Bảng danh sách cho bản in. KHÔNG bọc trong overflow-x-auto —
 * scroll container sẽ cắt nội dung khi in (cuộn ngang màn hình do
 * PrintLayout phụ trách). <thead> gốc được trình duyệt tự lặp lại
 * ở đầu mỗi trang in.
 * `compact`: layout khổ nhiệt K80 — chữ nhỏ, padding mỏng.
 * `dense`: khổ A5 — chữ/padding nhỏ hơn A4 (vẫn dễ đọc khi in).
 */
export default function PrintItemsTable({
    columns,
    rows,
    footer,
    emptyMessage = "Không có dữ liệu",
    compact = false,
    dense = false,
}) {
    return (
        <table
            className={cn(
                "w-full border-collapse",
                compact ? "text-[10px]" : dense ? "text-xs" : "text-[13px]"
            )}
        >
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th
                            key={column.key}
                            className={cn(
                                "border border-bo-border bg-bo-surface-subtle font-semibold uppercase tracking-wide text-bo-muted",
                                compact
                                    ? "px-1 py-1 text-[8px]"
                                    : dense
                                      ? "px-1.5 py-1 text-[9px]"
                                      : "px-2.5 py-2 text-[11px]",
                                column.className
                            )}
                        >
                            {column.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.length > 0 ? (
                    rows.map((row, rowIndex) => (
                        <tr key={row.key ?? rowIndex}>
                            {columns.map((column) => (
                                <td
                                    key={column.key}
                                    className={cn(
                                        "border border-bo-border align-top text-bo-foreground",
                                        compact ? "px-1 py-1" : dense ? "px-1.5 py-1" : "px-2.5 py-2",
                                        column.cellClassName
                                    )}
                                >
                                    {column.render ? column.render(row) : row[column.key]}
                                </td>
                            ))}
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td
                            colSpan={columns.length}
                            className={cn(
                                "border border-bo-border text-center italic text-bo-muted",
                                compact ? "px-1 py-6 text-[10px]" : "px-2.5 py-10 text-sm"
                            )}
                        >
                            {emptyMessage}
                        </td>
                    </tr>
                )}
            </tbody>
            {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
    );
}
