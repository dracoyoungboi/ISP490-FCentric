import { createPortal } from "react-dom";
import { getPaperPageCss, getPaperSheetClasses } from "./paperStyles";
import { useThermalPageHeight } from "./useThermalPageHeight";

/**
 * "Print mirror" — tờ giấy CHỈ-IN dùng chung cho các trang cấu hình mẫu in
 * (trang xem mẫu / editor / trang xem trước riêng): không hiển thị trên màn
 * hình, chỉ hiện trong @media print.
 *
 * Render qua PORTAL ra ngoài `document.body` (ngoài shell backoffice) — nhờ
 * quy tắc `body:has(.print-template-mirror)` trong previewPrintStyles, toàn
 * bộ shell bị ẩn khi trang chứa mirror -> bản in CHỈ gồm tờ giấy: không UI,
 * không nền xám/lớp phủ, không zoom màn hình, khổ giấy/lề đúng cấu hình
 * (mm) và bố cục in khớp bản xem trước.
 *
 * Trên màn hình mirror được đặt NGOÀI vùng nhìn (fixed, lệch trái, invisible)
 * thay vì display:none để vẫn ĐO được chiều cao — khổ nhiệt K80 dùng chiều
 * cao này làm chiều cao trang in (useThermalPageHeight); thẻ <style> @page
 * của K80 nằm cuối body nên ghi đè @page tạm của PreviewPrintStyleTag.
 *
 * Watermark "BẢN IN THỬ": dữ liệu mẫu được in kèm đầu giấy THẬT của công ty
 * nên phải đánh dấu để không bị nhầm là chứng từ thật. Phần tử position:fixed
 * trong bản in được trình duyệt lặp lại trên MỌI trang. Chỉ có ở mirror —
 * trang in thật không dùng component này nên không bao giờ có watermark.
 *
 * CHỈ dùng cho BẢN IN MẪU (dữ liệu minh họa). Trang in thật (PrintLayout /
 * PrintRoutePage) KHÔNG dùng component này.
 */
export default function PrintOnlyDocument({ paper, children }) {
    const isThermal = paper.size === "K80";
    const { ref: thermalRef, heightMm: thermalHeightMm } = useThermalPageHeight(isThermal);
    return createPortal(
        <div
            className="print-template-mirror pointer-events-none invisible fixed top-0 -left-[10000px] print:visible print:static"
            aria-hidden="true"
        >
            {isThermal ? (
                <style>{getPaperPageCss(paper, { thermalHeightMm })}</style>
            ) : null}
            <div
                ref={thermalRef}
                className={`print-mirror-sheet bg-white ${getPaperSheetClasses(paper)}`}
            >
                {children}
            </div>
            <div className="print-sample-watermark pointer-events-none fixed inset-0 z-10 flex items-center justify-center overflow-hidden">
                <span
                    className={`-rotate-[30deg] whitespace-nowrap font-bold uppercase tracking-[0.2em] text-black/10 ${isThermal ? "text-2xl" : "text-7xl"}`}
                >
                    Bản in thử
                </span>
            </div>
        </div>,
        document.body
    );
}
