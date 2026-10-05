import { createPortal } from "react-dom";
import { getPaperSheetClasses } from "./paperStyles";

/**
 * "Print mirror" — tờ giấy CHỈ-IN dùng chung cho các trang cấu hình mẫu in
 * (trang xem mẫu / editor / trang xem trước riêng): ẩn hoàn toàn trên màn
 * hình, chỉ hiển thị trong @media print.
 *
 * Render qua PORTAL ra ngoài `document.body` (ngoài shell backoffice) — nhờ
 * quy tắc `body:has(.print-template-mirror)` trong previewPrintStyles, toàn
 * bộ shell bị ẩn khi trang chứa mirror -> bản in CHỈ gồm tờ giấy: không UI,
 * không nền xám/lớp phủ, không zoom màn hình, khổ giấy/lề đúng cấu hình
 * (mm) và bố cục in khớp bản xem trước.
 *
 * CHỈ dùng cho BẢN IN MẪU (dữ liệu minh họa + nhãn "Bản in thử"). Trang in
 * thật (PrintLayout / PrintRoutePage) KHÔNG dùng component này.
 */
export default function PrintOnlyDocument({ paper, children }) {
    return createPortal(
        <div className="print-template-mirror hidden print:block" aria-hidden="true">
            <div className={`print-mirror-sheet bg-white ${getPaperSheetClasses(paper)}`}>
                {children}
            </div>
        </div>,
        document.body
    );
}
