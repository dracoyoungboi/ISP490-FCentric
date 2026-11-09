import { t } from "../i18n/t.js";
/**
 * Chính sách mật khẩu của FCentric (chốt 31/10/2026), dựa trên NIST SP 800-63B và OWASP Authentication Cheat Sheet,
 * điều chỉnh cho nhân viên kho / cửa hàng (gõ trên máy POS, điện thoại):
 * - dài 8–64 ký tự (NIST: tối thiểu 8, cho phép ít nhất 64 để dùng được cụm từ dài);
 * - có cả chữ và số (một yêu cầu nhẹ, dễ hiểu; KHÔNG bắt chữ hoa / ký tự đặc biệt vì làm người dùng chọn mật khẩu
 *   kiểu "Abc@1234" vừa khó nhớ vừa dễ đoán);
 * - không nằm trong danh sách mật khẩu phổ biến, không phải dãy lặp / liên tiếp (11111111, 12345678, abcd1234…);
 * - không chứa tên đăng nhập, phần trước @ của email hay tên hệ thống;
 * - khác mật khẩu hiện tại. Không bắt đổi định kỳ (NIST khuyên không làm).
 * Mật khẩu giữ nguyên như người dùng gõ (không cắt khoảng trắng), mọi ký tự Unicode đều hợp lệ.
 * BACKEND PHẢI KIỂM TRA Y HỆT — kiểm tra ở giao diện chỉ để báo sớm, gọi API thẳng là bỏ qua được.
 * Không import alias "@/..." để chạy được bằng `node --test`.
 */

/**
 * TẠM TẮT trong đợt test (chốt 31/10/2026): chỉ yêu cầu tối thiểu 6 ký tự như cũ, để tester đặt được mật khẩu 6 số.
 * Bật chính sách đầy đủ ở trên: đổi thành `true` (và sửa kiểm tra ở backend cùng lúc).
 */
export const AP_DUNG_CHINH_SACH_DAY_DU = false;

export const MAT_KHAU_TOI_THIEU = AP_DUNG_CHINH_SACH_DAY_DU ? 8 : 6;
export const MAT_KHAU_TOI_DA = 64;
const BCRYPT_TOI_DA_BYTE = 72;

/** Dòng gợi ý hiện sẵn dưới ô Mật khẩu mới (để trống khi chưa bật chính sách đầy đủ). */
export const GOI_Y_MAT_KHAU = AP_DUNG_CHINH_SACH_DAY_DU ? t("Từ {{toiThieu}} ký tự, có cả chữ và số.", { toiThieu: MAT_KHAU_TOI_THIEU }) : "";

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

const CHU = /\p{L}/u;
const SO = /\p{N}/u;
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
 * `ngữ cảnh`: { tenDangNhap, email, matKhauHienTai, dayDu } — `dayDu` mặc định theo AP_DUNG_CHINH_SACH_DAY_DU.
 */
export function kiemTraMatKhauMoi(
  mk,
  { tenDangNhap = "", email = "", matKhauHienTai = "", dayDu = AP_DUNG_CHINH_SACH_DAY_DU } = {},
) {
  const gt = mk ?? "";
  if (!gt) return t("Nhập mật khẩu mới.");
  const toiThieu = dayDu ? 8 : 6;
  const dai = [...gt].length;
  if (dai < toiThieu) return t("Cần ít nhất {{toiThieu}} ký tự (đang có {{dai}}).", { toiThieu, dai });
  if (dai > MAT_KHAU_TOI_DA) return t("Tối đa {{toiDa}} ký tự (đang có {{dai}}).", { toiDa: MAT_KHAU_TOI_DA, dai });
  // Máy chủ băm bằng BCrypt (tối đa 72 byte UTF-8): chữ có dấu chiếm 2–3 byte nên 64 ký tự có dấu vẫn có thể quá
  if (new TextEncoder().encode(gt).length > BCRYPT_TOI_DA_BYTE) {
    return t("Mật khẩu quá dài: chữ có dấu tính như 2–3 ký tự, hãy rút ngắn.");
  }
  // Luôn kiểm tra (kể cả khi tạm tắt chính sách đầy đủ): đổi sang đúng mật khẩu cũ là vô nghĩa
  if (matKhauHienTai && gt === matKhauHienTai) return t("Mật khẩu mới phải khác mật khẩu hiện tại.");
  if (!dayDu) return "";
  if (!CHU.test(gt) || !SO.test(gt)) return t("Cần có cả chữ và số.");

  const thuong = boDau(gt).toLowerCase();
  const ten = boDau(tenDangNhap || "").trim().toLowerCase();
  const truocA = boDau((email || "").split("@")[0] || "").trim().toLowerCase();
  if ((ten.length >= 3 && thuong.includes(ten)) || (truocA.length >= 3 && thuong.includes(truocA))) {
    return t("Không dùng tên đăng nhập hoặc email trong mật khẩu.");
  }
  if (PHO_BIEN.has(thuong.trim()) || laDayDonGian(gt)) return t("Mật khẩu này quá phổ biến, dễ bị đoán. Hãy chọn mật khẩu khác.");
  return "";
}
