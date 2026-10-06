/**
 * Ánh xạ cấu hình giấy (khổ / hướng / lề) sang class Tailwind cho tờ giấy
 * trên màn hình và CSS @page cho bản in.
 *
 * Quy tắc: class màn hình KHÔNG dùng inline style để các class `print:*`
 * (được tạo sau trong stylesheet) có thể ghi đè khi in.
 *
 * K80 là khổ giấy nhiệt 80mm — có layout compact riêng, KHÔNG phải bản A4
 * thu nhỏ (xem PrintTemplateDocument).
 */
const MM_TO_PX = 96 / 25.4;

export const SHEET_SIZE_CLASSES = {
    "A4-portrait": "w-[210mm] min-h-[297mm]",
    "A4-landscape": "w-[297mm] min-h-[210mm]",
    "A5-portrait": "w-[148mm] min-h-[210mm]",
    "A5-landscape": "w-[210mm] min-h-[148mm]",
    // K80: chiều cao tự do (giấy cuộn nhiệt), không ép chiều cao A4
    "K80-portrait": "w-[80mm] min-h-0",
    "K80-landscape": "w-[80mm] min-h-0",
};

/**
 * Lề giấy — ĐỊNH NGHĨA DUY NHẤT bằng đơn vị vật lý (mm), dùng chung cho cả
 * bản xem trước trên màn hình (trình duyệt render mm theo 96dpi) lẫn bản in
 * (@page margin = 0 — lề KHÔNG tính hai lần; tờ giấy giữ nguyên padding này
 * khi in nên bố cục in = bố cục xem trước).
 */
export const SHEET_PADDING_CLASSES = {
    narrow: "p-[8mm]",
    default: "p-[12mm]",
    wide: "p-[20mm]",
    // K80: lề nhiệt mỏng hơn để tận dụng khổ cuộn 80mm
    thermal: "p-[3mm]",
};

// Chiều rộng (mm) của từng khổ giấy — dùng cho zoom "Vừa trang"
const PAPER_WIDTH_MM = {
    A4: { portrait: 210, landscape: 297 },
    A5: { portrait: 148, landscape: 210 },
    K80: { portrait: 80, landscape: 80 },
};

// Chiều cao (mm) của từng khổ giấy tiêu chuẩn.
// K80 là giấy nhiệt cuộn — KHÔNG có chiều cao cố định (null = không ràng buộc).
const PAPER_HEIGHT_MM = {
    A4: { portrait: 297, landscape: 210 },
    A5: { portrait: 210, landscape: 148 },
    K80: { portrait: null, landscape: null },
};

/** Class cho tờ giấy trên màn hình (kích thước + padding) theo cấu hình. */
export function getPaperSheetClasses(paper) {
    const sizeKey = `${paper.size}-${paper.size === "K80" ? "portrait" : paper.orientation}`;
    const sizeClass = SHEET_SIZE_CLASSES[sizeKey] ?? SHEET_SIZE_CLASSES["A4-portrait"];
    const paddingClass =
        paper.size === "K80"
            ? SHEET_PADDING_CLASSES.thermal
            : SHEET_PADDING_CLASSES[paper.margin] ?? SHEET_PADDING_CLASSES.default;
    return `${sizeClass} ${paddingClass}`;
}

/** Chiều rộng tờ giấy tính bằng px (96 dpi) — dùng cho zoom. */
export function getPaperSheetWidthPx(paper) {
    const dims = PAPER_WIDTH_MM[paper.size] ?? PAPER_WIDTH_MM.A4;
    const widthMm = paper.size === "K80" ? 80 : dims[paper.orientation] ?? dims.portrait;
    return Math.round(widthMm * MM_TO_PX);
}

/** Chiều cao tờ giấy tính bằng px (96 dpi); K80 trả null (chiều cao tự nhiên). */
export function getPaperSheetHeightPx(paper) {
    const dims = PAPER_HEIGHT_MM[paper.size] ?? PAPER_HEIGHT_MM.A4;
    const heightMm = paper.size === "K80" ? null : dims[paper.orientation] ?? dims.portrait;
    return heightMm === null ? null : Math.round(heightMm * MM_TO_PX);
}

/**
 * Tỷ lệ zoom "Vừa trang": khớp CẢ chiều rộng lẫn chiều cao của khổ giấy
 * trong viewport (sau padding). KHÔNG BAO GIỜ phóng to quá 100% (màn hình
 * rộng không làm chữ to quá khổ in thật) và không thu quá nhỏ thành
 * thumbnail (sàn 0.3). K80 (giấy nhiệt liên tục) chỉ ràng buộc chiều rộng —
 * giữ nguyên chiều rộng 80mm tự nhiên, nội dung dài thì cuộn.
 * availWidth/availHeight phải là kích thước viewport ĐÃ trừ padding; trả 1
 * khi chưa đo được (tránh NaN/0-size flash).
 */
export function computeFitScale(paper, availWidth, availHeight) {
    const sheetWidth = getPaperSheetWidthPx(paper);
    if (!sheetWidth || !availWidth || availWidth <= 0) return 1;
    let scale = availWidth / sheetWidth;
    const sheetHeight = getPaperSheetHeightPx(paper);
    if (sheetHeight && availHeight > 0) {
        scale = Math.min(scale, availHeight / sheetHeight);
    }
    scale = Math.min(1, scale);
    return Math.max(0.3, scale);
}

/**
 * CSS @page động cho bản in theo cấu hình. Được chèn qua thẻ <style> nằm
 * sau print.css trong document order nên ghi đè @page mặc định.
 *
 * margin: 0 — lề vật lý do chính tờ giấy đảm nhiệm (SHEET_PADDING_CLASSES,
 * mm) để bản in và bản xem trước dùng ĐÚNG MỘT định nghĩa lề, không cộng dồn
 * hai lần, không làm nội dung co hẹp lại so với khổ giấy thiết kế.
 *
 * K80: khổ nhiệt 80mm — chiều cao khai báo 297mm (≈ A4) vì `size: 80mm auto`
 * KHÔNG phải cú pháp hợp lệ của CSS Paged Media (trình duyệt yêu cầu một
 * chiều dài xác định); đây chỉ là đơn vị phân trang cho trình duyệt, máy in
 * nhiệt cắt theo nội dung thật. Cần cấu hình khổ giấy 80mm ở driver máy in.
 */
export function getPaperPageCss(paper) {
    if (paper.size === "K80") {
        return "@media print { @page { size: 80mm 297mm; margin: 0; } }";
    }
    return `@media print { @page { size: ${paper.size} ${paper.orientation}; margin: 0; } }`;
}

/**
 * Vạch ranh giới trang cho BẢN XEM TRƯỚC (chỉ screen): kẻ một đường mờ đúng
 * mỗi chiều cao trang (297/210/148mm) kể từ đầu tờ giấy — chỉ lộ ra khi nội
 * dung dài hơn một trang, giúp nhìn trước vị trí ngắt trang. KHÔNG áp cho
 * bản in (tờ mirror dùng class riêng) và không áp cho K80 (giấy nhiệt liên
 * tục, không có ranh giới trang cố định).
 */
export function getPaperRulerCss(paper) {
    if (paper.size === "K80") return "";
    const heightMm =
        paper.size === "A4"
            ? paper.orientation === "landscape" ? 210 : 297
            : paper.orientation === "landscape" ? 148 : 210;
    return `@media screen {
  .print-preview-sheet.print-ruled {
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(${heightMm}mm - 1px),
      rgba(22, 119, 255, 0.16) calc(${heightMm}mm - 1px),
      rgba(22, 119, 255, 0.16) ${heightMm}mm
    );
  }
}`;
}
