import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORM_THEM,
  MA_SO_THUE_MESSAGE,
  MA_SO_THUE_SAI_SO,
  SO_DIEN_THOAI_MESSAGE,
  cacOThayDoi,
  canKiemTrung,
  chuanHoaMaKhiNhap,
  formTuKhachHang,
  kiemTraForm,
  loiSoDienThoai,
  loiTenKhachHang,
  oCuaThongBaoMayChu,
  payloadSua,
  payloadThem,
  thongBaoTrung,
} from "./quyTacKhachHang.js";
import { maSoThueDungDang, maSoThueHopLe } from "../../validations/maSoThue.js";

const them = (o = {}) => ({ ...FORM_THEM, tenKhachHang: "Đỗ Văn Nam", soDienThoai: "0990123456", ...o });
const loi = (o) => kiemTraForm(them(o));

test("tên khách lẻ theo luật họ tên: chặn số, ký tự lạ, 1 ký tự", () => {
  for (const ten of ["12345", "@@@ !!!", "Nam 0912", "=HYPERLINK(\"x\")", "A"]) {
    assert.ok(loi({ tenKhachHang: ten }).tenKhachHang, ten);
  }
  for (const ten of ["Đỗ Văn Nam", "O'Neil", "Nguyễn Thị Ánh-Dương", "Jean-Pierre", "Lê"]) {
    assert.equal(loi({ tenKhachHang: ten }).tenKhachHang, undefined, ten);
  }
  assert.equal(loiTenKhachHang("A", "le"), "Tên khách hàng cần ít nhất 2 ký tự");
  assert.equal(loiTenKhachHang("Nam 2", "le"), "Tên khách lẻ chỉ gồm chữ cái và dấu cách");
});

test("tên khách sỉ / doanh nghiệp / chưa phân loại: nhận số và & , . ( ) / - ', phải có chữ, mở đầu bằng chữ hoặc số", () => {
  for (const loai of ["si", "doanh_nghiep", ""]) {
    for (const ten of ["Công ty TNHH 3A", "Shop A&B", "Cửa hàng số 5 (Q.1)", "365 Fashion", "Đại lý An/Bình"]) {
      assert.equal(loiTenKhachHang(ten, loai), "", `${loai} ${ten}`);
    }
    assert.equal(loiTenKhachHang("=HYPERLINK(1)", loai), "Tên mở đầu bằng chữ hoặc số");
    assert.equal(loiTenKhachHang("-Shop", loai), "Tên mở đầu bằng chữ hoặc số");
    assert.equal(loiTenKhachHang("Shop #1", loai), "Tên chỉ gồm chữ, số và & , . ( ) / - '");
    assert.equal(loiTenKhachHang("12345", loai), "Tên cần có ít nhất một chữ cái");
    assert.equal(loiTenKhachHang("²Shop", loai), "Tên mở đầu bằng chữ hoặc số");
    assert.equal(loiTenKhachHang("Shop ½", loai), "Tên chỉ gồm chữ, số và & , . ( ) / - '");
  }
});

test("tên: bỏ ký tự vô hình, gộp khoảng trắng, NFC khi gửi; đếm độ dài theo ký tự", () => {
  assert.equal(payloadThem(them({ tenKhachHang: "  Đỗ    Văn ​  Nam  " })).tenKhachHang, "Đỗ Văn Nam");
  const nfd = "Đỗ Văn Nam".normalize("NFD");
  assert.equal(payloadThem(them({ tenKhachHang: nfd })).tenKhachHang, "Đỗ Văn Nam".normalize("NFC"));
  assert.equal(loi({ tenKhachHang: "Ă".repeat(200) }).tenKhachHang, undefined);
  assert.equal(loi({ tenKhachHang: "Ă".repeat(201) }).tenKhachHang, "Tên khách hàng tối đa 200 ký tự");
  assert.equal(loi({ tenKhachHang: "   " }).tenKhachHang, "Nhập tên khách hàng");
});

test("sửa: tên cũ sai luật không chặn sửa ô khác; đổi tên hoặc đổi loại thì kiểm lại", () => {
  const cu = formTuKhachHang({ id: 3, maKhachHang: "KH-SP-1", tenKhachHang: "Khách 0912", loaiKhachHang: "le", soDienThoai: "0912345678" });
  const tuyChon = { laSua: true, banDau: cu };
  assert.deepEqual(kiemTraForm({ ...cu, email: "a@congty.vn" }, tuyChon), {});
  assert.ok(kiemTraForm({ ...cu, tenKhachHang: "Khách 0913" }, tuyChon).tenKhachHang);
  const dn = formTuKhachHang({ id: 4, maKhachHang: "KH4", tenKhachHang: "Shop A&B", loaiKhachHang: "si", soDienThoai: "0912345678" });
  assert.deepEqual(kiemTraForm({ ...dn, diaChi: "1 Lê Lợi" }, { laSua: true, banDau: dn }), {});
  assert.equal(kiemTraForm({ ...dn, loaiKhachHang: "le" }, { laSua: true, banDau: dn }).tenKhachHang, "Tên khách lẻ chỉ gồm chữ cái và dấu cách");
  // Đổi sang sỉ / doanh nghiệp: luật chỉ nới ra, tên cũ (kể cả 1 ký tự) không bị kiểm lại
  const motKyTu = formTuKhachHang({ id: 9, maKhachHang: "KH9", tenKhachHang: "I", loaiKhachHang: "le", soDienThoai: "0912345678" });
  assert.deepEqual(kiemTraForm({ ...motKyTu, loaiKhachHang: "si" }, { laSua: true, banDau: motKyTu }), {});
  // Chỉ khác khoảng trắng thừa: không tính là đã sửa
  const thua = formTuKhachHang({ id: 5, maKhachHang: "KH5", tenKhachHang: "Đỗ  Văn Nam", loaiKhachHang: "le", soDienThoai: "0912345678" });
  assert.deepEqual(cacOThayDoi({ ...thua, tenKhachHang: "Đỗ Văn Nam" }, thua), []);
  assert.deepEqual(payloadSua({ ...thua, tenKhachHang: "Đỗ Văn  An " }, thua), { tenKhachHang: "Đỗ Văn An" });
});

test("người liên hệ: luật họ tên, không bắt buộc; dữ liệu cũ không đổi thì không kiểm", () => {
  assert.equal(loi({ nguoiLienHe: "0909" }).nguoiLienHe, "Người liên hệ chỉ gồm chữ cái và dấu cách");
  assert.equal(loi({ nguoiLienHe: "M" }).nguoiLienHe, "Người liên hệ cần ít nhất 2 ký tự");
  assert.equal(loi({ nguoiLienHe: "Trần Thị Mai" }).nguoiLienHe, undefined);
  assert.equal(loi({ nguoiLienHe: "   " }).nguoiLienHe, undefined);
  assert.equal(payloadThem(them({ nguoiLienHe: "  Trần   Mai " })).nguoiLienHe, "Trần Mai");
  assert.equal(payloadThem(them({ nguoiLienHe: "  " })).nguoiLienHe, null);
  const cu = formTuKhachHang({ id: 6, maKhachHang: "KH6", tenKhachHang: "Shop A", loaiKhachHang: "si", nguoiLienHe: "Chị Mai (kho)", soDienThoai: "0912345678" });
  assert.deepEqual(kiemTraForm({ ...cu, diaChi: "x" }, { laSua: true, banDau: cu }), {});
  assert.equal(oCuaThongBaoMayChu("Người liên hệ chỉ gồm chữ cái và dấu cách"), "nguoiLienHe");
});

test("mã số thuế: số kiểm tra, hậu tố chi nhánh, mã tỉnh của số 12 chữ số", () => {
  // MST thật: Viettel, Vinamilk, FPT
  for (const mst of ["0100109106", "0300588569", "0101248141", "0100109106-001", "0312345673", "001203004567", "096203004567"]) {
    assert.equal(maSoThueHopLe(mst), true, mst);
  }
  for (const mst of ["0312345678", "0000000000", "0100109106-000", "000203004567", "097203004567", "0100109107"]) {
    assert.equal(maSoThueDungDang(mst), true, mst);
    assert.equal(maSoThueHopLe(mst), false, mst);
  }
  const dn = them({ loaiKhachHang: "doanh_nghiep", tenKhachHang: "Công ty A" });
  assert.equal(kiemTraForm({ ...dn, maSoThue: "0312345678" }).maSoThue, MA_SO_THUE_SAI_SO);
  assert.equal(kiemTraForm({ ...dn, maSoThue: "03123" }).maSoThue, MA_SO_THUE_MESSAGE);
  assert.deepEqual(kiemTraForm({ ...dn, maSoThue: "0100109106-001" }), {});
  assert.equal(oCuaThongBaoMayChu(MA_SO_THUE_SAI_SO), "maSoThue");
  assert.equal(oCuaThongBaoMayChu("Mã số thuế đã thuộc khách hàng Công ty B (KH000012)"), "maSoThue");
  // MST cũ sai số kiểm tra không chặn sửa ô khác
  const cu = formTuKhachHang({ id: 7, maKhachHang: "KH7", tenKhachHang: "Công ty C", loaiKhachHang: "doanh_nghiep", maSoThue: "0312345678", soDienThoai: "0912345678" });
  assert.deepEqual(kiemTraForm({ ...cu, diaChi: "2 Lê Lợi" }, { laSua: true, banDau: cu }), {});
});

test("mã số thuế: kiểm trùng khi rời ô chỉ với mã hợp lệ và đã đổi", () => {
  const dn = them({ loaiKhachHang: "doanh_nghiep", tenKhachHang: "Công ty A" });
  assert.equal(canKiemTrung("maSoThue", { ...dn, maSoThue: "0100109106" }), true);
  assert.equal(canKiemTrung("maSoThue", { ...dn, maSoThue: "0312345678" }), false);
  const cu = formTuKhachHang({ id: 8, maKhachHang: "KH8", tenKhachHang: "Công ty A", loaiKhachHang: "doanh_nghiep", maSoThue: "0100109106", soDienThoai: "0912345678" });
  assert.equal(canKiemTrung("maSoThue", cu, { laSua: true, banDau: cu }), false);
  assert.equal(thongBaoTrung("maSoThue", { tenKhachHang: "Công ty B", maKhachHang: "KH9" }), "Mã số thuế này đã thuộc khách hàng Công ty B (KH9)");
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

test("POS thêm nhanh dùng chung luật: SĐT di động / máy bàn / tổng đài, tên khách lẻ", () => {
  assert.equal(loiSoDienThoai("0912345678"), "");
  assert.equal(loiSoDienThoai("02838123456"), "");
  assert.equal(loiSoDienThoai("19001234"), "");
  assert.equal(loiSoDienThoai("0123456789"), SO_DIEN_THOAI_MESSAGE);
  assert.equal(loiSoDienThoai("0412345678"), SO_DIEN_THOAI_MESSAGE);
  assert.equal(loiTenKhachHang("Nguyễn Văn A", "le"), "");
  assert.notEqual(loiTenKhachHang("Khách 1", "le"), "");
});

test("câu lỗi máy chủ → ô: xét đầu câu trước khi dò chứa", () => {
  assert.equal(oCuaThongBaoMayChu("Email đã thuộc khách hàng Mã Khách Hàng Lạ (KH2)"), "email");
  assert.equal(oCuaThongBaoMayChu("Email đã thuộc khách hàng Nguyễn Số Điện Thoại (KH4)"), "email");
  assert.equal(oCuaThongBaoMayChu("Tên mở đầu bằng chữ hoặc số"), "tenKhachHang");
  assert.equal(oCuaThongBaoMayChu("Tên khách lẻ chỉ gồm chữ cái và dấu cách"), "tenKhachHang");
  assert.equal(oCuaThongBaoMayChu("Cần số điện thoại hoặc email để liên hệ khách hàng"), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu("Số điện thoại đã thuộc khách hàng Email Shop (KH5)"), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu("Khách lẻ là khách mặc định của hệ thống"), null);
});
