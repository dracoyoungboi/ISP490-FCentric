/** Ngày theo giờ máy, dạng yyyy-MM-dd, lùi `soNgayTruoc` ngày. */
export function ngayIso(soNgayTruoc = 0) {
  const d = new Date();
  d.setDate(d.getDate() - soNgayTruoc);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
