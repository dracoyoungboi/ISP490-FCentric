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
 * Lề giấy (mm) — NGUỒN SỐ LIỆU DUY NHẤT cho cả hai nơi:
 * - màn hình: padding của tờ giấy (SHEET_PADDING_CLASSES bên dưới — Tailwind
 *   cần class viết sẵn nên giá trị được lặp lại ở đó, PHẢI khớp bảng này);
 * - bản in: `@page { margin }` (getPaperPageCss). Lề do trình duyệt áp cho
 *   TỪNG trang nên phiếu dài nhiều trang vẫn có lề trên/dưới ở mọi trang;
 *   khi in tờ giấy bỏ padding (print:p-0!) để lề không bị tính hai lần.
 */
export const PAPER_MARGIN_MM = {
    narrow: 8,
    default: 12,
    wide: 20,
    // K80: lề nhiệt mỏng để tận dụng khổ cuộn 80mm
    thermal: 3,
};

/** Lề (mm) của một cấu hình giấy. */
export function getPaperMarginMm(paper) {
    if (paper.size === "K80") return PAPER_MARGIN_MM.thermal;
    return PAPER_MARGIN_MM[paper.margin] ?? PAPER_MARGIN_MM.default;
}

/** Padding màn hình — giá trị PHẢI khớp PAPER_MARGIN_MM. */
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

/**
 * Class cho tờ giấy theo cấu hình: màn hình = kích thước + padding (lề);
 * khi in = bỏ chiều rộng cố định và padding (print:w-auto! print:p-0!) vì
 * khổ giấy + lề đã do @page đảm nhiệm — vùng nội dung in rộng đúng bằng
 * vùng nội dung trên bản xem trước.
 */
export function getPaperSheetClasses(paper) {
    const sizeKey = `${paper.size}-${paper.size === "K80" ? "portrait" : paper.orientation}`;
    const sizeClass = SHEET_SIZE_CLASSES[sizeKey] ?? SHEET_SIZE_CLASSES["A4-portrait"];
    const paddingClass =
        paper.size === "K80"
            ? SHEET_PADDING_CLASSES.thermal
            : SHEET_PADDING_CLASSES[paper.margin] ?? SHEET_PADDING_CLASSES.default;
    return `${sizeClass} ${paddingClass} print:w-auto! print:p-0!`;
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
 * margin = lề cấu hình (PAPER_MARGIN_MM) — trình duyệt áp lề cho TỪNG trang
 * nên chỗ ngắt trang không còn sát mép giấy. Tờ giấy bỏ padding khi in nên
 * lề không cộng dồn hai lần. Lưu ý: hộp thoại in phải để Lề = "Mặc định"
 * (chọn "Không có" thì trình duyệt bỏ qua @page margin).
 *
 * K80: giấy nhiệt CUỘN — `size: 80mm auto` không phải cú pháp hợp lệ nên
 * chiều cao trang = chiều cao THẬT của nội dung (`thermalHeightMm`, đo bởi
 * useThermalPageHeight) -> cả phiếu nằm trên MỘT trang, không bị cắt giữa
 * chừng và không đẩy ra giấy trắng thừa. Chưa đo được -> tạm 297mm.
 * Cần chọn khổ giấy cuộn 80mm ở driver máy in nhiệt.
 */
export function getPaperPageCss(paper, { thermalHeightMm } = {}) {
    const margin = getPaperMarginMm(paper);
    if (paper.size === "K80") {
        const height = thermalHeightMm > 0 ? thermalHeightMm : 297;
        return `@media print { @page { size: 80mm ${height}mm; margin: ${margin}mm; } }`;
    }
    return `@media print { @page { size: ${paper.size} ${paper.orientation}; margin: ${margin}mm; } }`;
}

/**
 * Vạch ngắt trang cho BẢN XEM TRƯỚC (chỉ screen): mỗi trang in chứa
 * (chiều cao trang − 2 × lề) nội dung, nên vạch thứ k nằm ở
 * lề + k × (chiều cao trang − 2 × lề) tính từ mép trên tờ giấy — tức bội số
 * của chiều cao vùng nội dung, đo từ mép trên vùng nội dung (content-box).
 * Lớp vạch chỉ vẽ trong content-box (không lộ vạch ở lề); lớp nền trắng thứ
 * hai phủ cả tờ giấy. Chỉ lộ ra khi nội dung dài hơn một trang. KHÔNG áp cho
 * bản in và K80 (giấy nhiệt liên tục, không có ranh giới trang cố định).
 */
export function getPaperRulerCss(paper) {
    if (paper.size === "K80") return "";
    const dims = PAPER_HEIGHT_MM[paper.size] ?? PAPER_HEIGHT_MM.A4;
    const heightMm = dims[paper.orientation] ?? dims.portrait;
    if (!heightMm) return "";
    const contentHeightMm = heightMm - 2 * getPaperMarginMm(paper);
    return `@media screen {
  .print-preview-sheet.print-ruled {
    background-image:
      linear-gradient(to bottom, transparent calc(100% - 1px), rgba(22, 119, 255, 0.16) calc(100% - 1px)),
      linear-gradient(#fff, #fff);
    background-size: 100% ${contentHeightMm}mm, auto;
    background-repeat: repeat-y, no-repeat;
    background-origin: content-box, border-box;
    background-clip: content-box, border-box;
  }
}`;
}
