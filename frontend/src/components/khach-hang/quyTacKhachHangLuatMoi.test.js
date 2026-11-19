import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORM_THEM,
  SO_DIEN_THOAI_MESSAGE,
  cacOThayDoi,
  chuanHoaMaKhiNhap,
  formTuKhachHang,
  kiemTraForm,
  loiSoDienThoai,
  loiTenKhachHang,
  oCuaThongBaoMayChu,
  payloadSua,
  payloadThem,
} from "./quyTacKhachHang.js";

const them = (o = {}) => ({ ...FORM_THEM, tenKhachHang: "Đỗ Văn Nam", soDienThoai: "0990123456", ...o });
const loi = (o) => kiemTraForm(them(o));

test("tên khách theo luật họ tên: chặn số, ký tự lạ, 1 ký tự", () => {
  for (const ten of ["12345", "@@@ !!!", "Nam 0912", "=HYPERLINK(\"x\")", "A", "Shop A&B", "Công ty TNHH 3A"]) {
    assert.ok(loi({ tenKhachHang: ten }).tenKhachHang, ten);
  }
  for (const ten of ["Đỗ Văn Nam", "O'Neil", "Nguyễn Thị Ánh-Dương", "Jean-Pierre", "Lê"]) {
    assert.equal(loi({ tenKhachHang: ten }).tenKhachHang, undefined, ten);
  }
  assert.equal(loiTenKhachHang("A"), "Tên khách hàng cần ít nhất 2 ký tự");
  assert.equal(loiTenKhachHang("Nam 2"), "Tên khách hàng chỉ gồm chữ cái và dấu cách");
});

test("tên: bỏ ký tự vô hình, gộp khoảng trắng, NFC khi gửi; đếm độ dài theo ký tự", () => {
  assert.equal(payloadThem(them({ tenKhachHang: "  Đỗ    Văn ​  Nam  " })).tenKhachHang, "Đỗ Văn Nam");
  const nfd = "Đỗ Văn Nam".normalize("NFD");
  assert.equal(payloadThem(them({ tenKhachHang: nfd })).tenKhachHang, "Đỗ Văn Nam".normalize("NFC"));
  assert.equal(loi({ tenKhachHang: "Ă".repeat(200) }).tenKhachHang, undefined);
  assert.equal(loi({ tenKhachHang: "Ă".repeat(201) }).tenKhachHang, "Tên khách hàng tối đa 200 ký tự");
  assert.equal(loi({ tenKhachHang: "   " }).tenKhachHang, "Nhập tên khách hàng");
});

test("sửa: tên cũ sai luật không chặn sửa ô khác; đổi tên thì kiểm lại", () => {
  const cu = formTuKhachHang({ id: 3, maKhachHang: "KH-SP-1", tenKhachHang: "Khách 0912", soDienThoai: "0912345678" });
  const tuyChon = { laSua: true, banDau: cu };
  assert.deepEqual(kiemTraForm({ ...cu, email: "a@congty.vn" }, tuyChon), {});
  assert.ok(kiemTraForm({ ...cu, tenKhachHang: "Khách 0913" }, tuyChon).tenKhachHang);
  // Chỉ khác khoảng trắng thừa: không tính là đã sửa
  const thua = formTuKhachHang({ id: 5, maKhachHang: "KH5", tenKhachHang: "Đỗ  Văn Nam", soDienThoai: "0912345678" });
  assert.deepEqual(cacOThayDoi({ ...thua, tenKhachHang: "Đỗ Văn Nam" }, thua), []);
  assert.deepEqual(payloadSua({ ...thua, tenKhachHang: "Đỗ Văn  An " }, thua), { tenKhachHang: "Đỗ Văn An" });
});

test("email: chặn hai dấu chấm liền, đuôi 1 chữ, chấm đầu/cuối, có dấu", () => {
  for (const email of ["a@gmail..com", "a@b.c", ".nam@gmail.com", "nam.@gmail.com", "nam@côngty.vn", "nam@-congty.vn", "nam@congty", "nam@@congty.vn", "na m@congty.vn"]) {
    assert.equal(loi({ email }).email, "Email chưa đúng, VD: ten@congty.vn", email);
  }
  for (const email of ["nam.do@gmail.com", "Nam_Do+shop@cong-ty.com.vn", "a1@b2.io", "muahang@minhkhoi.example.vn"]) {
    assert.equal(loi({ email }).email, undefined, email);
  }
});

test("mã khách nhập tay: mở đầu bằng chữ hoặc số; không tự cắt độ dài", () => {
  assert.ok(loi({ maKhachHang: "---" }).maKhachHang);
  assert.ok(loi({ maKhachHang: ".KH1" }).maKhachHang);
  assert.equal(loi({ maKhachHang: "KH-001.A_1" }).maKhachHang, undefined);
  assert.equal(chuanHoaMaKhiNhap("a".repeat(60)).length, 60);
  assert.equal(loi({ maKhachHang: "A".repeat(51) }).maKhachHang, "Mã khách hàng tối đa 50 ký tự");
});

test("POS thêm nhanh dùng cùng luật: SĐT di động / máy bàn (không tổng đài), tên là họ tên", () => {
  assert.equal(loiSoDienThoai("0912345678"), "");
  assert.equal(loiSoDienThoai("02838123456"), "");
  assert.equal(loiSoDienThoai("19001234"), SO_DIEN_THOAI_MESSAGE);
  assert.equal(loiSoDienThoai("0123456789"), SO_DIEN_THOAI_MESSAGE);
  assert.equal(loiSoDienThoai("0412345678"), SO_DIEN_THOAI_MESSAGE);
  assert.equal(loiTenKhachHang("Nguyễn Văn A"), "");
  assert.notEqual(loiTenKhachHang("Khách 1"), "");
});

test("câu lỗi máy chủ → ô: xét đầu câu trước khi dò chứa", () => {
  assert.equal(oCuaThongBaoMayChu("Email đã thuộc khách hàng Mã Khách Hàng Lạ (KH2)"), "email");
  assert.equal(oCuaThongBaoMayChu("Email đã thuộc khách hàng Nguyễn Số Điện Thoại (KH4)"), "email");
  assert.equal(oCuaThongBaoMayChu("Tên khách hàng chỉ gồm chữ cái và dấu cách"), "tenKhachHang");
  assert.equal(oCuaThongBaoMayChu("Cần số điện thoại hoặc email để liên hệ khách hàng"), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu("Số điện thoại đã thuộc khách hàng Email Shop (KH5)"), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu("Khách lẻ là khách mặc định của hệ thống"), null);
  assert.equal(oCuaThongBaoMayChu("Nhập di động 10 số hoặc máy bàn 11 số"), "soDienThoai");
});
