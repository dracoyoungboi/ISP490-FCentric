/**
 * Hàng ô ký (2–4 ô) theo cách trình bày chứng từ Việt Nam: chức danh in đậm,
 * "(Ký, ghi rõ họ tên)" ngay dưới, chừa khoảng trống ký tay, cuối cùng là họ
 * tên in sẵn (nếu hệ thống biết người ký). Không in email, không có chữ ký giả.
 * Ô có `name` rỗng là ô ký TRỐNG (người ngoài hệ thống ký và ghi tên tay).
 * Khổ nhiệt K80: các ô xếp dọc (printDocument.css).
 * `blockProps`: thuộc tính khối bấm được của trình sửa mẫu (rỗng khi in thật).
 */
export default function PrintSignatures({ blocks, blockProps }) {
    if (!blocks || blocks.length === 0) return null;
    return (
        <div className="pdoc-signs" style={{ "--pdoc-signs": Math.min(blocks.length, 4) }} {...blockProps}>
            {blocks.map((block) => (
                <div key={block.key ?? block.label}>
                    <p className="pdoc-sign-title">{block.label}</p>
                    <p className="pdoc-sign-hint">(Ký, ghi rõ họ tên)</p>
                    <div className="pdoc-sign-space" />
                    <p className="pdoc-sign-name">{block.name || " "}</p>
                </div>
            ))}
        </div>
    );
}
