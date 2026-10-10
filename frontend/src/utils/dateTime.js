const pad = (n) => String(n).padStart(2, "0");

/** "10/10/2026 · 13:10" (hoặc "10/10 · 13:10" khi withYear = false), theo giờ máy người dùng. */
export function formatDateTime(value, { withYear = true, withSeconds = false } = {}) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const date = withYear
    ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? `:${pad(d.getSeconds())}` : ""}`;
  return `${date} · ${time}`;
}
