import { t } from "../i18n/t.js";
/**
 * Luật mật khẩu mới (chốt 27/11/2026), dùng ở Đổi mật khẩu, Quên mật khẩu và trang đặt mật khẩu qua liên kết:
 * - chỉ ký tự trên bàn phím tiếng Anh: chữ không dấu, số, ký tự đặc biệt; không có dấu cách (đầu, giữa hay cuối).
 *   Không nhận chữ có dấu vì cùng một chữ "ệ" mỗi bộ gõ gửi một kiểu mã khác nhau: đặt trên máy này có thể không đăng
 *   nhập được trên máy khác;
 * - dài 8–64 ký tự (64 ký tự không dấu luôn dưới giới hạn 72 byte của BCrypt ở máy chủ);
 * - có đủ chữ hoa A–Z, chữ thường a–z, số 0–9 và ký tự đặc biệt (thông lệ ngân hàng Việt Nam);
 * - khác mật khẩu hiện tại (hộp Đổi mật khẩu).
 * Chỉ áp khi đặt mật khẩu mới: mật khẩu đang dùng giữ nguyên, không bắt đổi. Tạm chưa chặn mật khẩu phổ biến / dãy đơn
 * giản và mật khẩu chứa tên đăng nhập / email: phần kiểm đó vẫn để dưới đây, bật bằng CHAN_PHO_BIEN_VA_TEN.
 * MÁY CHỦ KIỂM Y HỆT ở backend utils/MatKhau.java: sửa một bên thì sửa cả bên kia.
 * Không import alias "@/..." để chạy được bằng `node --test`.
 */

/** Tạm tắt (27/11/2026). Bật lại thì thêm kiểm tương ứng ở backend utils/MatKhau.java cùng lúc. */
export const CHAN_PHO_BIEN_VA_TEN = false;

export const MAT_KHAU_TOI_THIEU = 8;
export const MAT_KHAU_TOI_DA = 64;

/** Dòng gợi ý hiện sẵn dưới ô Mật khẩu mới. */
export const GOI_Y_MAT_KHAU = t("{{toiThieu}}–{{toiDa}} ký tự, không dấu, không dấu cách, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.", {
  toiThieu: MAT_KHAU_TOI_THIEU,
  toiDa: MAT_KHAU_TOI_DA,
});

/**
 * Hạn liên kết đặt mật khẩu gửi qua email (tạo tài khoản, quản trị viên cấp lại), hiện ở các hộp xác nhận.
 * Phải khớp LienKetDatMatKhauService.HIEU_LUC ở backend; giờ hết hạn ghi trong email thì backend tự tính.
 */
export const HAN_LIEN_KET_MAT_KHAU = t("24 giờ");

// Mật khẩu phổ biến (so sánh không phân biệt hoa thường). Danh sách ngắn các mật khẩu hay gặp ở Việt Nam và quốc tế;
// backend nên dùng danh sách dài hơn (vd. 10.000 mật khẩu phổ biến nhất).
const PHO_BIEN = new Set([
  "password", "password1", "password123", "passw0rd", "matkhau", "matkhau1", "matkhau123", "matkhau@123",
  "12345678", "123456789", "1234567890", "87654321", "11111111", "00000000", "88888888", "66666666",
  "qwerty123", "qwertyui", "1qaz2wsx", "abc12345", "abcd1234", "a1234567", "aa123456", "abc123456",
  "iloveyou", "iloveyou1", "anhyeuem", "anhyeuem1", "emyeuanh", "123456aa", "123456ab", "123456a@",
  "admin123", "admin1234", "administrator", "welcome1", "welcome123", "123123123", "112233445566",
  "fcentric", "fcentric1", "fcentric123", "fcentric@123", "khohang123", "banhang123", "nhanvien123",
]);

// Cùng cách tính với máy chủ: chỉ ký tự in được ASCII (! tới ~), ký tự đặc biệt là mọi ký tự không phải chữ / số
const DAU_CACH = /[\s\p{Z}]/u;
const NGOAI_BAN_PHIM = /[^!-~]/;
const HOA = /[A-Z]/;
const THUONG = /[a-z]/;
const SO = /[0-9]/;
const DAC_BIET = /[^A-Za-z0-9]/;
const HANG_PHIM = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

const boDau = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D");

/** Độ dài đoạn dài nhất là ký tự lặp lại, hoặc chữ/số liên tiếp tăng/giảm (aaaa, 1234, dcba). */
function doanDeuDaiNhat(ma) {
  let dai = 1;
  for (let i = 0; i < ma.length - 1; i++) {
    const buoc = ma[i + 1] - ma[i];
    if (Math.abs(buoc) > 1) continue;
    let j = i + 1;
    while (j + 1 < ma.length && ma[j + 1] - ma[j] === buoc) j++;
    dai = Math.max(dai, j - i + 1);
  }
  return dai;
}

/** Độ dài đoạn dài nhất nằm liền trên một hàng phím (qwerty, asdfgh, xuôi hoặc ngược). */
function doanHangPhimDaiNhat(s) {
  const hang = HANG_PHIM.flatMap((h) => [h, [...h].reverse().join("")]);
  let dai = 0;
  for (let i = 0; i < s.length; i++) {
    for (let j = i + dai + 1; j <= s.length; j++) {
      if (hang.some((h) => h.includes(s.slice(i, j)))) dai = j - i;
      else break;
    }
  }
  return dai;
}

/**
 * Mật khẩu "đơn giản": chỉ 1–2 ký tự khác nhau (a1a1a1a1), hoặc gần như toàn bộ là một dãy lặp / liên tiếp / hàng phím
 * (thêm tối đa 2 ký tự: 1234567a, aaaaaa12, qwertyu1).
 */
function laDayDonGian(mk) {
  const s = mk.toLowerCase();
  const ma = [...s].map((c) => c.codePointAt(0));
  if (new Set(ma).size <= 2) return true;
  const doan = Math.max(doanDeuDaiNhat(ma), doanHangPhimDaiNhat(s));
  return ma.length - doan <= 2;
}

/**
 * Kiểm tra mật khẩu mới. Trả về câu báo lỗi (một lỗi, theo thứ tự ưu tiên) hoặc "" nếu hợp lệ.
 * `ngữ cảnh`: { tenDangNhap, email, matKhauHienTai, chanPhoBien } — `chanPhoBien` mặc định theo CHAN_PHO_BIEN_VA_TEN.
 */
export function kiemTraMatKhauMoi(
  mk,
  { tenDangNhap = "", email = "", matKhauHienTai = "", chanPhoBien = CHAN_PHO_BIEN_VA_TEN } = {},
) {
  const gt = mk ?? "";
  if (!gt.trim()) return t("Nhập mật khẩu mới.");
  if (DAU_CACH.test(gt)) return t("Mật khẩu không được có dấu cách.");
  if (NGOAI_BAN_PHIM.test(gt)) return t("Chỉ dùng chữ không dấu, số và ký tự đặc biệt trên bàn phím.");
  const toiThieu = MAT_KHAU_TOI_THIEU;
  const dai = gt.length;
  if (dai < toiThieu) return t("Cần ít nhất {{toiThieu}} ký tự (đang có {{dai}}).", { toiThieu, dai });
  if (dai > MAT_KHAU_TOI_DA) return t("Tối đa {{toiDa}} ký tự (đang có {{dai}}).", { toiDa: MAT_KHAU_TOI_DA, dai });
  if (!HOA.test(gt) || !THUONG.test(gt) || !SO.test(gt) || !DAC_BIET.test(gt)) {
    return t("Cần có chữ hoa, chữ thường, số và ký tự đặc biệt.");
  }
  if (matKhauHienTai && gt === matKhauHienTai) return t("Mật khẩu mới phải khác mật khẩu hiện tại.");
  if (!chanPhoBien) return "";

  const thuong = boDau(gt).toLowerCase();
  const ten = boDau(tenDangNhap || "").trim().toLowerCase();
  const truocA = boDau((email || "").split("@")[0] || "").trim().toLowerCase();
  if ((ten.length >= 3 && thuong.includes(ten)) || (truocA.length >= 3 && thuong.includes(truocA))) {
    return t("Không dùng tên đăng nhập hoặc email trong mật khẩu.");
  }
  if (PHO_BIEN.has(thuong.trim()) || laDayDonGian(gt)) return t("Mật khẩu này quá phổ biến, dễ bị đoán. Hãy chọn mật khẩu khác.");
  return "";
}
