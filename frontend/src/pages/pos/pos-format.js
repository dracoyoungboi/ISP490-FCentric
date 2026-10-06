export const formatMoney = (value) => `${Number(value || 0).toLocaleString('en-US')} ₫`;

export const clampMoney = (value, ceiling) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, Math.round(parsed)), Math.max(0, ceiling));
};
