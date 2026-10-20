import { useLayoutEffect, useRef } from "react";

/** Các bậc nới bảng khi bảng rộng hơn vùng in (xem fitTable). */
const TIGHT_STEPS = ["pdoc-table--chat", "pdoc-table--chat-ma"];

/**
 * Lưới an toàn chống tràn lề: bảng nhiều cột + nhãn cột tự đặt dài + chữ Lớn + mã / số tiền dài
 * có thể rộng hơn vùng in (nhất là A5). Đo bảng sau khi dựng; nếu tràn thì nới dần các ràng buộc
 * mềm (printDocument.css): (1) tên hàng bỏ bề rộng tối thiểu, tiêu đề cột được ngắt giữa từ;
 * (2) mã SKU / mã lô được xuống dòng sau dấu "-". Bảng vừa thì không đổi gì.
 * Class gắn thẳng vào DOM (React không quản lý class này vì className của bảng không đổi).
 */
function fitTable(table) {
    if (!table?.parentElement) return;
    table.classList.remove(...TIGHT_STEPS);
    const overflows = () => table.offsetWidth > table.parentElement.clientWidth + 1;
    for (const step of TIGHT_STEPS) {
        if (!overflows()) return;
        table.classList.add(step);
    }
}

/**
 * Bảng hàng cho bản in — chỉ kẻ ngang, không nền xám (in trắng đen rõ).
 * KHÔNG bọc trong overflow-x-auto (vùng cuộn cắt nội dung khi in). <thead>
 * được trình duyệt lặp lại ở đầu mỗi trang in; <tfoot> in như hàng cuối,
 * chỉ một lần (printDocument.css).
 *
 * `columns`: [{ key, label, className?, render(row) }]
 */
export default function PrintItemsTable({ columns, rows, footer, emptyMessage = "Không có dữ liệu" }) {
    const tableRef = useRef(null);

    // Đo lại sau mỗi lần dựng (đổi cột, nhãn, cỡ chữ, khổ giấy) và khi phông chữ tải xong
    useLayoutEffect(() => {
        const table = tableRef.current;
        fitTable(table);
        let active = true;
        document.fonts?.ready?.then(() => {
            if (active) fitTable(table);
        });
        return () => {
            active = false;
        };
    });

    return (
        <table ref={tableRef} className="pdoc-table">
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th key={column.key} className={column.className}>
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
                                <td key={column.key} className={column.className}>
                                    {column.render ? column.render(row) : row[column.key]}
                                </td>
                            ))}
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={columns.length} className="pdoc-empty">
                            {emptyMessage}
                        </td>
                    </tr>
                )}
            </tbody>
            {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
    );
}
