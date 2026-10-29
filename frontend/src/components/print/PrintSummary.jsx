/** Class của một dòng tổng theo vai trò (dòng chính, dòng con, chú thích, dòng đầu sau nhóm dòng con). */
function rowClass(row) {
    const classes = [
        row.emphasis && "pdoc-summary-main",
        row.sub && "pdoc-summary-sub",
        row.note && "pdoc-summary-note",
        row.afterSub && "pdoc-summary-after-sub",
    ].filter(Boolean);
    return classes.length > 0 ? classes.join(" ") : undefined;
}

/**
 * Khối tổng tiền căn phải dưới bảng hàng + dòng "Bằng chữ" cả hàng.
 * `rows`: [{ key, label, value, emphasis?, sub?, note?, afterSub? }] (dongKhoiTong) — dòng emphasis (tổng chính) in
 * đậm, có đường kẻ trên; dòng sub (phần "trong đó") thụt vào, chữ nhỏ, xám; dòng note là chú thích không có số, trải
 * hết khối. Khổ nhiệt K80: khối rộng hết tờ (printDocument.css).
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
                                <tr key={row.key} className={rowClass(row)}>
                                    {row.note ? (
                                        <td colSpan={2}>{row.label}</td>
                                    ) : (
                                        <>
                                            <td>{row.label}</td>
                                            <td>{row.value}</td>
                                        </>
                                    )}
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
