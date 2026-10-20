import { cn } from "@/lib/utils";

/**
 * Khối đề mục trong bản in: tiêu đề chữ hoa nhỏ, không đường kẻ, không màu
 * (in trắng đen vẫn rõ). `keepTogether`: không cắt đôi khối khi sang trang;
 * tiêu đề luôn đi cùng nội dung ngay sau nó (printDocument.css).
 * `blockProps`: thuộc tính khối bấm được của trình sửa mẫu (rỗng khi in thật).
 */
export default function PrintSection({ title, children, className, keepTogether = false, blockProps }) {
    return (
        <section className={cn("pdoc-section", keepTogether && "pdoc-keep", className)} {...blockProps}>
            {title ? <h2 className="pdoc-section-title">{title}</h2> : null}
            {children}
        </section>
    );
}
