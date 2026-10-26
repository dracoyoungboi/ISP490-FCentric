// Bố trí ô kích cỡ trong danh mục POS (không phụ thuộc React — kiểm thử độc lập được).
//
// Ô kích cỡ xếp theo "khe" cố định: chế độ Danh sách khe 56px, Lưới khe 40px. Nhãn rộng hơn một khe
// ("Free size", "XXXXL") chiếm 2–3 khe chứ không bị cắt chữ. Danh sách hiện tối đa 1 dòng ô, Lưới tối đa
// 2 dòng; không đủ chỗ thì ô cuối là "+N" mở khay chọn cỡ (PosSizeTray).

export const LIST_SLOT = 56;
export const LIST_GAP = 6;
export const GRID_SLOT = 40;
export const GRID_GAP = 4;
/** Đệm ngang + viền của một ô (px-1 hai bên + viền 1px hai bên): chữ phải lọt trong khe trừ phần này. */
export const CHIP_CHROME = 10;

// Dòng Danh sách: đệm dòng 8px mỗi bên; ảnh 44 + 3 khe cột 12 + cột giá 160 (10rem).
const LIST_ROW_PADDING = 16;
const LIST_FIXED = 44 + 3 * 12 + 160;
const LIST_NAME_MIN = 200;
const LIST_MAX_SLOTS = 12;
// Ít hơn số khe này thì dòng xếp 2 tầng (ô kích cỡ xuống tầng dưới, trải hết bề ngang).
const LIST_MIN_INLINE_SLOTS = 5;

// Lưới: thẻ rộng tối thiểu 190px, cách nhau 12px, tối thiểu 2 cột. Phần không dành cho ô trong thẻ:
// viền 2 + p-1.5 hai bên 12 (khối ô trải hết bề ngang bên trong thẻ, không có đệm riêng).
const GRID_CARD_MIN = 190;
const GRID_COLUMN_GAP = 12;
const GRID_CARD_CHROME = 14;
export const GRID_MAX_ROWS = 2;

const slotsIn = (width, slot, gap) => Math.floor((width + gap) / (slot + gap));
const slotsWidth = (slots, slot, gap) => slots * slot + Math.max(0, slots - 1) * gap;

/**
 * Bố cục dòng Danh sách theo bề rộng nội dung vùng danh mục (đã trừ đệm và thanh cuộn).
 * Mọi dòng của trang dùng chung kết quả nên cột ô kích cỡ và cột giá thẳng hàng.
 */
export function listLayout(contentWidth) {
  const rowWidth = Math.max(0, contentWidth - LIST_ROW_PADDING);
  const inline = Math.min(LIST_MAX_SLOTS, slotsIn(rowWidth - LIST_FIXED - LIST_NAME_MIN, LIST_SLOT, LIST_GAP));
  if (inline >= LIST_MIN_INLINE_SLOTS) {
    return { stacked: false, slots: inline, sizesWidth: slotsWidth(inline, LIST_SLOT, LIST_GAP) };
  }
  const slots = Math.max(1, slotsIn(rowWidth, LIST_SLOT, LIST_GAP));
  return { stacked: true, slots, sizesWidth: slotsWidth(slots, LIST_SLOT, LIST_GAP) };
}

/** Bố cục Lưới: số cột theo bề rộng vùng (không theo bề rộng màn), số khe ô kích cỡ mỗi dòng của thẻ. */
export function gridLayout(contentWidth) {
  const width = Math.max(0, contentWidth);
  const cols = Math.max(2, Math.floor((width + GRID_COLUMN_GAP) / (GRID_CARD_MIN + GRID_COLUMN_GAP)));
  const cardWidth = (width - (cols - 1) * GRID_COLUMN_GAP) / cols;
  const slotsPerRow = Math.max(2, slotsIn(cardWidth - GRID_CARD_CHROME, GRID_SLOT, GRID_GAP));
  return { cols, cardWidth, slotsPerRow };
}

/** Số khe một nhãn cần (1–3) khi chữ rộng textWidth px. */
export function slotSpan(textWidth, slot, gap) {
  const needed = textWidth + CHIP_CHROME;
  if (needed <= slot) return 1;
  if (needed <= slot * 2 + gap) return 2;
  return 3;
}

/** Xếp lần lượt theo dòng như CSS grid (ô nhiều khe không bị cắt ngang dòng): vừa trong maxRows không. */
export function packs(spans, perRow, maxRows) {
  let row = 1;
  let used = 0;
  for (const raw of spans) {
    const span = Math.min(raw, perRow);
    if (used + span > perRow) {
      row += 1;
      used = 0;
    }
    used += span;
    if (row > maxRows) return false;
  }
  return true;
}

/** Kích cỡ còn bán được: tồn > 0, hoặc chưa biết tồn (null — không coi là hết). */
const isSellable = (variant) => !Number.isFinite(variant.stock) || variant.stock > 0;

/**
 * Chọn các kích cỡ hiện trên dòng/thẻ. Đủ chỗ: hiện tất cả, đúng thứ tự. Thiếu chỗ: chừa 1 khe cho ô
 * "+N" và ưu tiên (1) kích cỡ khớp mã đang tìm, (2) kích cỡ còn bán được, (3) kích cỡ đã hết; các ô
 * được hiện vẫn đứng theo đúng thứ tự kích cỡ.
 * Ô nhiều khe có thể làm hụt chỗ cuối dòng, nên thử thêm một lượt ưu tiên ô 1 khe trước rồi lấy lượt
 * hiện được nhiều kích cỡ còn bán hơn (bằng nhau thì lấy lượt hiện nhiều ô hơn).
 * @returns {{ visible: number[], hidden: number[] }} chỉ số trong variants
 */
export function fitSizes(variants, { spans, perRow, maxRows, isMatched = () => false }) {
  const order = variants.map((_, index) => index);
  if (packs(spans, perRow, maxRows)) return { visible: order, hidden: [] };
  const rank = (index) => (isMatched(variants[index]) ? 0 : isSellable(variants[index]) ? 1 : 2);
  const pick = (priority) => {
    const chosen = [];
    for (const index of priority) {
      const trial = [...chosen, index].sort((a, b) => a - b);
      if (packs([...trial.map((i) => spans[i]), 1], perRow, maxRows)) chosen.push(index);
    }
    return chosen.sort((a, b) => a - b);
  };
  const byRank = pick([...order].sort((a, b) => rank(a) - rank(b) || a - b));
  const narrowFirst = pick([...order].sort((a, b) => rank(a) - rank(b) || spans[a] - spans[b] || a - b));
  const score = (chosen) => [chosen.filter((i) => rank(i) < 2).length, chosen.length];
  const [sellA, countA] = score(byRank);
  const [sellB, countB] = score(narrowFirst);
  const chosen = sellB > sellA || (sellB === sellA && countB > countA) ? narrowFirst : byRank;
  const shown = new Set(chosen);
  return { visible: chosen, hidden: order.filter((index) => !shown.has(index)) };
}

/**
 * Giá hiển thị của một nhóm (mẫu + màu): chỉ tính kích cỡ còn bán được và có giá > 0; không kích cỡ nào
 * còn bán thì lấy mọi kích cỡ có giá; không kích cỡ nào có giá -> none.
 * multi = các kích cỡ (trong phạm vi trên) có từ 2 mức giá -> ô kích cỡ ghi giá riêng.
 */
export function priceSummary(variants) {
  const priced = variants.filter((variant) => Number(variant.price) > 0);
  const sellable = priced.filter(isSellable);
  const base = sellable.length ? sellable : priced;
  if (!base.length) return { none: true, min: 0, max: 0, multi: false };
  const prices = base.map((variant) => Number(variant.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { none: false, min, max, multi: min !== max };
}
