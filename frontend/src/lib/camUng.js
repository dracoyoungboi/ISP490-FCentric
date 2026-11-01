/*
 * Đánh dấu màn cảm ứng: <html data-cam-ung> khi con trỏ chính là ngón tay ((pointer: coarse) — điện thoại, máy tính
 * bảng). Biến thể Tailwind cam-ung: (index.css) đọc thuộc tính này, nên máy tính dùng chuột không đổi giao diện.
 * Trang demo / kiểm thử đặt sẵn data-cam-ung-co-dinh để giữ nguyên giá trị đã đặt.
 */
export function batTheoDoiCamUng() {
  const goc = document.documentElement;
  if (goc.hasAttribute("data-cam-ung-co-dinh") || typeof window.matchMedia !== "function") return;
  const mq = window.matchMedia("(pointer: coarse)");
  const dat = () => goc.toggleAttribute("data-cam-ung", mq.matches);
  dat();
  mq.addEventListener?.("change", dat);
}

export const laCamUng = () => document.documentElement.hasAttribute("data-cam-ung");
