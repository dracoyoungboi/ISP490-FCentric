/**
 * Khối tổng tiền căn phải dưới bảng hàng + dòng "Bằng chữ" cả hàng.
 * `rows`: [{ key, label, value, emphasis? }] — dòng emphasis (tổng chính) in đậm,
 * có đường kẻ trên. Khổ nhiệt K80: khối rộng hết tờ (printDocument.css).
 * `blockProps`: thuộc tính khối bấm được của trình sửa mẫu (rỗng khi in thật).
 */
export default function PrintSummary({ rows, words, blockProps }) {
    if (rows.length === 0 && !words) return null;
    return (
        <div className="pdoc-keep" {...blockProps}>
            {rows.length > 0 ? (
                <div className="pdoc-summary">
                    <table>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.key} className={row.emphasis ? "pdoc-summary-main" : undefined}>
                                    <td>{row.label}</td>
                                    <td>{row.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
            {words ? (
                <p className="pdoc-words">
                    <span className="pdoc-label">{words.label}:</span>{" "}
                    <span className="pdoc-words-value">{words.value}</span>
                </p>
            ) : null}
        </div>
    );
}
