/**
 * Hẹn mở hộp "Xếp kệ hàng vừa nhận" trên chi tiết phiếu chuyển ngay sau khi nhận hàng: màn nhận đánh dấu trong
 * sessionStorage (thẻ trình duyệt hiện tại) rồi về chi tiết phiếu (lùi lịch sử nên không truyền được state); chi tiết
 * phiếu đọc dấu lúc mở và xóa. Dấu cũ hơn HAN_MS bỏ qua (nhận xong rồi đi nơi khác, lâu sau mới mở lại phiếu).
 * Bộ nhớ bị chặn (chế độ riêng tư, chính sách trình duyệt) thì không hẹn: hàng vẫn có dòng nhắc "Xếp kệ" trên phiếu.
 */
const khoa = (phieuChuyenId) => `fc:hen-xep-ke:${phieuChuyenId}`;
export const HAN_MS = 10 * 60 * 1000;

export function henXepKe(phieuChuyenId, bayGio = Date.now()) {
  try {
    sessionStorage.setItem(khoa(phieuChuyenId), String(bayGio));
  } catch {
    // Không ghi được: bỏ qua
  }
}

/** Có hẹn còn hạn cho phiếu không (chỉ đọc, gọi được trong hàm khởi tạo state). */
export function coHenXepKe(phieuChuyenId, bayGio = Date.now()) {
  try {
    const v = Number(sessionStorage.getItem(khoa(phieuChuyenId)));
    return Number.isFinite(v) && v > 0 && bayGio - v >= 0 && bayGio - v < HAN_MS;
  } catch {
    return false;
  }
}

export function xoaHenXepKe(phieuChuyenId) {
  try {
    sessionStorage.removeItem(khoa(phieuChuyenId));
  } catch {
    // Không xóa được: bỏ qua
  }
}
