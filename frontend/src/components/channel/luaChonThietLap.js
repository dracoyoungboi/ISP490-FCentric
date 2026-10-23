/**
 * Lựa chọn chờ "Hoàn tất" của Thiết lập sàn ủy quyền (KH mục B.3): lần thiết lập đầu, công tắc tự động ở bước 2–3
 * lưu tạm là tắt, lựa chọn thật và "Lấy thêm đơn cũ" giữ ở đây tới khi bấm Hoàn tất (lúc đó sản phẩm đã ghép).
 * Lưu localStorage để thoát giữa chừng rồi vào lại vẫn còn; gắn với gian hàng đang kết nối (`shopIdSan`) và có hạn,
 * nên lựa chọn sót lại không bị áp sang gian hàng khác hay áp lại sau nhiều ngày. Cấu hình lưu công tắc tự động
 * hoặc ngắt kết nối thì xóa.
 */
const khoa = (maKenh) => `fc:thiet-lap:${String(maKenh ?? "").toUpperCase()}`;
const HAN_MS = 14 * 86_400_000;
const gianHangCua = (ketNoi) => ketNoi?.shopIdSan ?? null;

/** Lựa chọn còn hiệu lực của gian hàng đang kết nối; không có thì {}. */
export function docLuaChonThietLap(maKenh, ketNoi, bayGio = Date.now()) {
  try {
    const giaTri = JSON.parse(window.localStorage.getItem(khoa(maKenh)) ?? "null");
    if (!giaTri || typeof giaTri !== "object") return {};
    if ((giaTri.gianHang ?? null) !== gianHangCua(ketNoi)) return {};
    if (!(bayGio - Number(giaTri.luc) < HAN_MS)) return {};
    return giaTri;
  } catch {
    return {};
  }
}

/** Trả false khi trình duyệt chặn lưu: bước đó lưu thẳng giá trị người dùng chọn, không đợi Hoàn tất. */
export function ghiLuaChonThietLap(maKenh, ketNoi, them) {
  try {
    const moi = { ...docLuaChonThietLap(maKenh, ketNoi), ...them, gianHang: gianHangCua(ketNoi), luc: Date.now() };
    window.localStorage.setItem(khoa(maKenh), JSON.stringify(moi));
    return true;
  } catch {
    return false;
  }
}

export function xoaLuaChonThietLap(maKenh) {
  try {
    window.localStorage.removeItem(khoa(maKenh));
  } catch {
    // Bỏ qua: lựa chọn hết hạn sau HAN_MS hoặc lần thiết lập sau ghi đè
  }
}

export const coLuaChonTuDong = (luaChon) =>
  typeof luaChon?.tuDongDayTon === "boolean" || typeof luaChon?.tuDongLayDon === "boolean";

/**
 * Việc "Hoàn tất" sẽ làm theo lựa chọn đang chờ: chỉ bật công tắc mà máy chủ còn đang tắt (giá trị tạm của Thiết lập).
 * Trả { batTuDong: {tuDongDayTon?, tuDongLayDon?}, soNgayDonCu, viec: ["bật tự động cập nhật tồn", …] }.
 */
export function viecKhiHoanTat(luaChon, cauHinh) {
  const batTuDong = {};
  const viec = [];
  if (luaChon?.tuDongDayTon === true && cauHinh?.tuDongDayTon === false) {
    batTuDong.tuDongDayTon = true;
    viec.push("bật tự động cập nhật tồn");
  }
  if (luaChon?.tuDongLayDon === true && cauHinh?.tuDongLayDon === false) {
    batTuDong.tuDongLayDon = true;
    viec.push("bật tự động lấy đơn");
  }
  const soNgayDonCu = Number(luaChon?.layDonCu) > 0 ? Number(luaChon.layDonCu) : 0;
  if (soNgayDonCu) viec.push(`lấy đơn ${soNgayDonCu} ngày qua`);
  return { batTuDong, soNgayDonCu, viec };
}
