/**
 * Các dòng "Nhãn: giá trị" cho bản in — kiểu ghi trên chứng từ Việt Nam,
 * gọn hơn lưới nhãn chữ hoa nằm trên giá trị (cũ) nên phiếu ít dòng vừa một trang.
 * `items`: [{ label, value, wide? }]; `columns`: số cột cố định (1|2) — tờ
 * giấy có kích thước cố định nên KHÔNG dùng breakpoint theo cửa sổ trình duyệt.
 * Khổ nhiệt K80 luôn một cột (printDocument.css).
 */
export default function PrintDocumentInfo({ items, columns = 2 }) {
    return (
        <div className="pdoc-fields" style={{ "--pdoc-cols": columns }}>
            {items.map((item, index) => (
                <p key={item.key ?? index} className={item.wide ? "pdoc-field pdoc-field--wide" : "pdoc-field"}>
                    <span className="pdoc-label">{item.label}:</span>{" "}
                    <span className="pdoc-value">{item.value ?? "—"}</span>
                </p>
            ))}
        </div>
    );
}
