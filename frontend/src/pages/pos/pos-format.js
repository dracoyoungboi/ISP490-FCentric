export const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

/** Một giá, hoặc khoảng "thấp – cao" khi các kích cỡ của một mẫu có giá khác nhau. */
export const formatPriceRange = (min, max) => {
  if (!Number.isFinite(max) || max <= min) return formatMoney(min);
  return `${Number(min || 0).toLocaleString('vi-VN')} – ${formatMoney(max)}`;
};

export const clampMoney = (value, ceiling) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, Math.round(parsed)), Math.max(0, ceiling));
};
