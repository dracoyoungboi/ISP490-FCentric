// Chạy: node --test src/pages/admin/thongBaoMatKhauTam.test.js
// E2/E3 (liên kết đặt mật khẩu, thay mật khẩu tạm từ 01/11/2026) đi sau khi lưu, qua hàng đợi email có thử lại: giao diện
// không được báo "Đã gửi" như thể email đã tới (test đầu-cuối F3). Cùng cách nói ở hộp Thêm người dùng và Gửi liên kết.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const doc = (tep) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), tep), "utf8");

test("gửi liên kết / thêm người dùng: 'Liên kết … sẽ được gửi tới {email}', không 'Đã gửi', không còn mật khẩu tạm", () => {
  const chiTiet = doc("ViewUserDetailByAdmin.jsx");
  // Câu đi qua t() (đa ngôn ngữ): khóa là câu tiếng Việt, email truyền qua tham số
  assert.match(chiTiet, /t\("Liên kết đặt lại mật khẩu sẽ được gửi tới \{\{email\}\}\.", \{ email: nguoiDung\.email \}\)/);
  assert.doesNotMatch(chiTiet, /Đã gửi (mật khẩu|liên kết)/);
  assert.doesNotMatch(chiTiet, /mật khẩu tạm/i);
  const danhSach = doc("ViewUserListByAdmin.jsx");
  assert.match(danhSach, /t\("Liên kết đặt mật khẩu cho \{\{tenDangNhap\}\} sẽ được gửi tới \{\{email\}\}\.", \{ tenDangNhap: user\.tenDangNhap, email: user\.email \}\)/);
  assert.match(danhSach, /t\("Liên kết đặt lại mật khẩu sẽ được gửi tới \{\{email\}\}\.", \{ email: user\.email \}\)/);
  assert.doesNotMatch(danhSach, /Đã gửi (mật khẩu|liên kết)/);
  assert.doesNotMatch(danhSach, /mật khẩu tạm/i);
});
