/** Ngày theo giờ máy, dạng yyyy-MM-dd, lùi `soNgayTruoc` ngày. */
export function ngayIso(soNgayTruoc = 0) {
  const d = new Date();
  d.setDate(d.getDate() - soNgayTruoc);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "09/12" (`coNam` = true: "09/12/2026") theo giờ máy; giá trị trống hoặc sai thì null. */
export function ngayThang(value, { coNam = false } = {}) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}${coNam ? `/${d.getFullYear()}` : ""}`;
}
