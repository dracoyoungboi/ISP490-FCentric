import test from "node:test";
import assert from "node:assert/strict";

import { MAT_KHAU_TOI_DA, kiemTraMatKhauMoi } from "./matKhau.js";

// Cùng ca với backend MatKhauTest
const BON_LOAI = "Cần có chữ hoa, chữ thường, số và ký tự đặc biệt.";
const DAU_CACH = "Mật khẩu không được có dấu cách.";
const NGOAI_BAN_PHIM = "Chỉ dùng chữ không dấu, số và ký tự đặc biệt trên bàn phím.";

test("độ dài 8–64 ký tự", () => {
  assert.equal(kiemTraMatKhauMoi(""), "Nhập mật khẩu mới.");
  assert.equal(kiemTraMatKhauMoi("Kho@202"), "Cần ít nhất 8 ký tự (đang có 7).");
  assert.equal(kiemTraMatKhauMoi("Kho@2026"), "");
  assert.equal(kiemTraMatKhauMoi("Aa1!" + "a".repeat(60)), "");
  assert.equal(kiemTraMatKhauMoi("Aa1!" + "a".repeat(61)), `Tối đa ${MAT_KHAU_TOI_DA} ký tự (đang có 65).`);
});

test("không dấu cách ở bất kỳ đâu", () => {
  assert.equal(kiemTraMatKhauMoi("        "), "Nhập mật khẩu mới.");
  for (const mk of ["Kho tong@2026", " Kho@2026", "Kho@2026 ", "Kho@2026\t", "Kho @2026"]) {
    assert.equal(kiemTraMatKhauMoi(mk), DAU_CACH, JSON.stringify(mk));
  }
});

test("chỉ ký tự trên bàn phím tiếng Anh, không chữ có dấu", () => {
  for (const mk of ["Hà@Nội2026", "Đalat@2026", "Kho@2026€", "Kho@2026😀"]) assert.equal(kiemTraMatKhauMoi(mk), NGOAI_BAN_PHIM, mk);
  // cùng chữ "ệ" ở dạng tổ hợp (e + dấu) cũng bị chặn
  assert.equal(kiemTraMatKhauMoi("Kho@2026ệ"), NGOAI_BAN_PHIM);
});

test("phải đủ chữ hoa, chữ thường, số và ký tự đặc biệt", () => {
  for (const mk of ["kho@2026hn", "KHO@2026HN", "Kho@hangtong", "Kho2026hn", "20262027"]) assert.equal(kiemTraMatKhauMoi(mk), BON_LOAI, mk);
  for (const mk of ["Khang123@", "Kho2026#hn", "Ab1~cdef", "P@ssw0rd"]) assert.equal(kiemTraMatKhauMoi(mk), "", mk);
});

test("khác mật khẩu hiện tại", () => {
  assert.equal(kiemTraMatKhauMoi("Kho@2026", { matKhauHienTai: "Kho@2026" }), "Mật khẩu mới phải khác mật khẩu hiện tại.");
  assert.equal(kiemTraMatKhauMoi("Kho@2027", { matKhauHienTai: "Kho@2026" }), "");
});

test("đang tạm tắt: chưa chặn mật khẩu phổ biến và mật khẩu chứa tên đăng nhập / email", () => {
  const NC = { tenDangNhap: "lan.nt", email: "lan.nt@fcentric.vn" };
  for (const mk of ["Matkhau@123", "Qwerty1!", "Lan.nt@2026"]) assert.equal(kiemTraMatKhauMoi(mk, NC), "", mk);
});

test("khi bật lại: chặn mật khẩu phổ biến, dãy đơn giản, chứa tên đăng nhập / email", () => {
  const NC = { tenDangNhap: "lan.nt", email: "lan.nt@fcentric.vn", chanPhoBien: true };
  const PB = "Mật khẩu này quá phổ biến, dễ bị đoán. Hãy chọn mật khẩu khác.";
  for (const mk of ["Matkhau@123", "Fcentric@123", "Aaaaaa1!", "Qwerty1!"]) assert.equal(kiemTraMatKhauMoi(mk, NC), PB, mk);
  assert.equal(kiemTraMatKhauMoi("Lan.nt@2026", NC), "Không dùng tên đăng nhập hoặc email trong mật khẩu.");
  assert.equal(kiemTraMatKhauMoi("Cum@TuDeNho9", NC), "");
});
