import test from "node:test";
import assert from "node:assert/strict";

import { MAT_KHAU_TOI_DA, kiemTraMatKhauMoi } from "./matKhau.js";

// Các test dưới kiểm tra chính sách ĐẦY ĐỦ (dayDu: true), dù đang tạm tắt trong đợt test
const NC = { tenDangNhap: "lan.nt", email: "lan.nt@fcentric.vn", matKhauHienTai: "cu12345678", dayDu: true };
const DD = { dayDu: true };

test("độ dài: 8–64 ký tự, đếm theo ký tự (cả tiếng Việt có dấu)", () => {
  assert.equal(kiemTraMatKhauMoi("", NC), "Nhập mật khẩu mới.");
  assert.equal(kiemTraMatKhauMoi("kho2026", NC), "Cần ít nhất 8 ký tự (đang có 7).");
  assert.equal(kiemTraMatKhauMoi("kho20261", NC), "");
  const dai64 = "kho tong ha noi 2026 ".repeat(4).slice(0, 64);
  assert.equal(kiemTraMatKhauMoi(dai64, NC), "");
  assert.equal(kiemTraMatKhauMoi(dai64 + "x", NC), `Tối đa ${MAT_KHAU_TOI_DA} ký tự (đang có 65).`);
  assert.equal(kiemTraMatKhauMoi("Hà Nội 2026", NC), "");
});

test("phải có cả chữ và số, không bắt chữ hoa hay ký tự đặc biệt", () => {
  assert.equal(kiemTraMatKhauMoi("khohangtong", NC), "Cần có cả chữ và số.");
  assert.equal(kiemTraMatKhauMoi("20262027", NC), "Cần có cả chữ và số.");
  assert.equal(kiemTraMatKhauMoi("cafe sua da 3 ly", NC), "");
});

test("khác mật khẩu hiện tại; không chứa tên đăng nhập / email (bỏ dấu, không phân biệt hoa thường)", () => {
  assert.equal(kiemTraMatKhauMoi("cu12345678", NC), "Mật khẩu mới phải khác mật khẩu hiện tại.");
  assert.equal(kiemTraMatKhauMoi("LAN.NT2026", NC), "Không dùng tên đăng nhập hoặc email trong mật khẩu.");
  assert.equal(kiemTraMatKhauMoi("toi la Lan.nt 1", NC), "Không dùng tên đăng nhập hoặc email trong mật khẩu.");
  assert.equal(kiemTraMatKhauMoi("ab1cdefgh", { tenDangNhap: "ab", dayDu: true }), "", "tên quá ngắn (<3) thì không xét");
});

test("chặn mật khẩu phổ biến, dãy lặp, dãy liên tiếp, hàng phím", () => {
  const PB = "Mật khẩu này quá phổ biến, dễ bị đoán. Hãy chọn mật khẩu khác.";
  for (const mk of ["Matkhau123", "ABCD1234", "fcentric@123", "Anhyeuem1", "a1a1a1a1", "1234567a"]) {
    const kq = kiemTraMatKhauMoi(mk, DD);
    assert.ok(kq === PB || kq === "Cần có cả chữ và số.", `${mk} phải bị chặn, nhận: ${kq}`);
  }
  assert.equal(kiemTraMatKhauMoi("matkhau123", DD), PB);
  assert.equal(kiemTraMatKhauMoi("a1a1a1a1", DD), PB);
  for (const mk of ["1234567a", "aaaaaa12", "qwertyu1", "zyxwvu98"]) assert.equal(kiemTraMatKhauMoi(mk, DD), PB, mk);
  for (const mk of ["CumTuDeNho9", "kho20261", "banhang 3 ca", "Hà Nội 2026"]) assert.equal(kiemTraMatKhauMoi(mk, NC), "", mk);
});

test("đang tạm tắt: chỉ cần tối thiểu 6 ký tự, mật khẩu 6 số vẫn đặt được", () => {
  assert.equal(kiemTraMatKhauMoi("12345"), "Cần ít nhất 6 ký tự (đang có 5).");
  assert.equal(kiemTraMatKhauMoi("123456"), "");
  assert.equal(kiemTraMatKhauMoi("matkhau"), "");
  assert.equal(kiemTraMatKhauMoi("", {}), "Nhập mật khẩu mới.");
  assert.equal(kiemTraMatKhauMoi("123456", { matKhauHienTai: "123456" }), "Mật khẩu mới phải khác mật khẩu hiện tại.");
});

test("quá 72 byte (giới hạn BCrypt của máy chủ) thì báo ngay, kể cả khi chưa tới 64 ký tự", () => {
  const coDau = "ệ".repeat(25); // 25 ký tự, 75 byte
  assert.equal(kiemTraMatKhauMoi(coDau), "Mật khẩu quá dài: chữ có dấu tính như 2–3 ký tự, hãy rút ngắn.");
  assert.equal(kiemTraMatKhauMoi("ệ".repeat(24)), "", "24 ký tự có dấu = 72 byte vẫn được");
});
