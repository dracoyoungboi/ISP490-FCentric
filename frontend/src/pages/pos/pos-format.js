export const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

/** Một giá, hoặc khoảng "thấp – cao" khi các kích cỡ của một mẫu có giá khác nhau. */
export const formatPriceRange = (min, max) => {
  if (!Number.isFinite(max) || max <= min) return formatMoney(min);
  return `${Number(min || 0).toLocaleString('vi-VN')} – ${formatMoney(max)}`;
};

/** Số đếm có dấu chấm hàng nghìn ("2.400 mẫu", "Còn 13.582"). */
export const formatCount = (value) => Number(value || 0).toLocaleString('vi-VN');

/**
 * Giá gọn cho ô kích cỡ (chỗ hẹp): dưới 1 triệu ghi theo nghìn ("120k", "133,2k"), từ 1 triệu ghi theo
 * triệu tối đa 3 số lẻ ("1,29tr", "2,6tr", "1,995tr") để hai giá khác nghìn không ra cùng một chữ.
 * Không có giá -> "—".
 */
export const formatPriceShort = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  const trim = (number, digits) => number.toFixed(digits).replace(/\.?0+$/, '').replace('.', ',');
  // 999.950 làm tròn thành "1000k" -> ghi theo triệu.
  if (amount >= 1e6 || Math.round(amount / 100) >= 10000) return `${trim(amount / 1e6, 3)}tr`;
  if (amount >= 1e3) return `${trim(amount / 1e3, 1)}k`;
  return `${Math.round(amount)}đ`;
};

export const clampMoney = (value, ceiling) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, Math.round(parsed)), Math.max(0, ceiling));
};
