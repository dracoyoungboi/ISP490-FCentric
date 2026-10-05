import { getPaperPageCss, getPaperRulerCss } from "./paperStyles";

/**
 * Style khi in từ các trang cấu hình mẫu in nằm TRONG BackofficeLayout
 * (trang xem mẫu / editor / trang xem trước riêng).
 *
 * Các trang này render một "print mirror" — PrintOnlyDocument, tờ giấy
 * chỉ-in ẩn hoàn toàn trên màn hình. Khi in:
 * - TOÀN BỘ shell backoffice bị ẩn (sidebar, header, rail loại chứng từ,
 *   toolbar, card, nền xám, lớp phủ, toast) -> trang in CHỈ còn nội dung
 *   chứng từ; mọi quy tắc cũ "bóc UI" bằng :has() không còn cần thiết.
 * - Tờ giấy giữ nguyên kích thước mm + padding mm của cấu hình và KHÔNG có
 *   zoom màn hình -> tỷ lệ in = 100% khổ giấy thật, bố cục in = bố cục xem
 *   trước (@page margin = 0, lề do chính tờ giấy đảm nhiệm — không tính 2 lần).
 *
 * Dùng chung cho trang cấu hình mẫu in (preview nhúng), editor và trang
 * xem trước riêng (PrintTemplateDetailPage).
 */
const PREVIEW_PRINT_STYLES = `
@media print {
  /* Ẩn TOÀN BỘ ứng dụng (#root giữ chiều cao ~viewport dù shell đã ẩn —
     nếu không ẩn #root sẽ chèn 1-2 trang trống trước tờ giấy) */
  body:has(.print-template-mirror) #root,
  body:has(.print-template-mirror) [data-backoffice-shell] { display: none !important; }
  body:has(.print-template-mirror) [data-sonner-toaster],
  body:has(.print-template-mirror) [data-radix-popper-content-wrapper],
  body:has(.print-template-mirror) [data-slot="dialog-overlay"] { display: none !important; }
  .print-template-mirror { display: block !important; }
  .print-mirror-sheet { min-height: 0 !important; border: none !important; box-shadow: none !important; }
}
`;

/** Thẻ <style> cho các trang preview trong shell backoffice:
 *  quy tắc mirror khi in + @page theo khổ giấy + vạch ranh giới trang. */
export function PreviewPrintStyleTag({ paper }) {
    return (
        <style>
            {PREVIEW_PRINT_STYLES}
            {getPaperPageCss(paper)}
            {getPaperRulerCss(paper)}
        </style>
    );
}
