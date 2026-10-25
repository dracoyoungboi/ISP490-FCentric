// Tiện ích đọc một dòng danh mục POS (mẫu + màu + chất liệu) và các kích cỡ của nó (không phụ thuộc React).
import { formatPriceRange, formatPriceRangeShort } from './pos-format.js';

/** Chữ giá của dòng theo priceSummary (pos-size-layout): một giá, khoảng giá, hoặc "Chưa có giá". */
export const priceLabelOf = (summary) => (summary.none ? 'Chưa có giá' : formatPriceRange(summary.min, summary.max));

/**
 * Chữ giá ở thẻ Lưới: khoảng giá rộng hơn chỗ một dòng (`room` px, đo bằng `measure`) thì ghi gọn như ô kích
 * cỡ ("133,2k – 2,6tr"), để dòng giá không xuống dòng làm ô cỡ lệch so với thẻ bên cạnh. Một giá và
 * "Chưa có giá" giữ nguyên.
 */
export const gridPriceLabelOf = (summary, measure, room) => {
  const full = priceLabelOf(summary);
  return summary.multi && measure(full) > room ? formatPriceRangeShort(summary.min, summary.max) : full;
};

/** Tồn đã biết của một kích cỡ (null = chưa có dữ liệu, không coi là hết). */
export const knownStock = (variant) => (Number.isFinite(variant.stock) ? variant.stock : null);

/** Kích cỡ đã biết là hết (tồn <= 0). */
export const isKnownOut = (variant) => {
  const stock = knownStock(variant);
  return stock !== null && stock <= 0;
};

/** Tên đầy đủ của nhóm: mẫu · màu (· chất liệu) — hai dòng cùng mẫu + màu khác chất liệu không trùng tên. */
export const groupTitle = (group) => [group.name, group.colorName, group.materialName].filter(Boolean).join(' · ');

/** Mã SKU / mã vạch của kích cỡ có chứa từ khóa đang tìm (đã viết thường) không. */
export const matchesCode = (variant, code) => Boolean(code)
  && [variant.sku, variant.barcode].some((value) => value && String(value).toLowerCase().includes(code));
