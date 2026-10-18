/**
 * Logic thuần của việc tải lại danh sách (không phụ thuộc React hay DOM) để test được bằng node.
 * Chạy test: node --test src/lib/tinhTaiLai.test.js
 */

/** Hai lần tự tải lại khi quay lại tab phải cách nhau ít nhất chừng này (ms). Bấm nút ⟳ thì không bị giới hạn. */
export const GIA_CACH_TU_TAI_LAI_MS = 30_000;

const hai = (so) => String(so).padStart(2, "0");

/**
 * Có nên tự tải lại khi người dùng quay lại tab / cửa sổ không.
 * - `bat`: trang cho phép (vd. false khi đang tải hoặc đang sửa dở).
 * - `hienThi`: tab đang hiện (document.visibilityState === "visible").
 * - `coHopThoai`: đang mở popup / hộp xác nhận — không tải lại để khỏi đổi dữ liệu dưới tay người dùng.
 * - `bayGio`, `lanCuoi`: mốc thời gian (ms). `lanCuoi` rỗng = chưa tải lần nào.
 */
export function nenTuTaiLai({ bat, hienThi, coHopThoai, bayGio, lanCuoi, giaCach = GIA_CACH_TU_TAI_LAI_MS }) {
  if (!bat || !hienThi || coHopThoai) return false;
  if (lanCuoi == null) return true;
  return bayGio - lanCuoi >= giaCach;
}

/** "Cập nhật lúc 14:16". Chưa có thời điểm thì trả chuỗi rỗng. */
export function nhanCapNhat(thoiDiem) {
  if (!(thoiDiem instanceof Date) || Number.isNaN(thoiDiem.getTime())) return "";
  return `Cập nhật lúc ${hai(thoiDiem.getHours())}:${hai(thoiDiem.getMinutes())}`;
}

/** "14:16:05 18/10/2026" — hiện khi rê chuột vào chữ "Cập nhật lúc". */
export function thoiDiemDayDu(thoiDiem) {
  if (!(thoiDiem instanceof Date) || Number.isNaN(thoiDiem.getTime())) return "";
  const gio = `${hai(thoiDiem.getHours())}:${hai(thoiDiem.getMinutes())}:${hai(thoiDiem.getSeconds())}`;
  const ngay = `${hai(thoiDiem.getDate())}/${hai(thoiDiem.getMonth() + 1)}/${thoiDiem.getFullYear()}`;
  return `${gio} ${ngay}`;
}
