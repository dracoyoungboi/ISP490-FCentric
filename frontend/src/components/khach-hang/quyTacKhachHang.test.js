import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAN_LIEN_HE,
  FORM_THEM,
  MA_SO_THUE_MESSAGE,
  SO_DIEN_THOAI_MESSAGE,
  cacOThayDoi,
  canKiemTrung,
  chuanHoaMaKhiNhap,
  chuanHoaMaSoThueKhiNhap,
  chuanHoaSoDienThoaiKhiNhap,
  formThemCoNhap,
  formTuKhachHang,
  goiYTen,
  hienMaSoThue,
  hienNguoiLienHe,
  kiemTraForm,
  nhanDiaChi,
  oCuaThongBaoMayChu,
  payloadSua,
  payloadThem,
  thongBaoTrung,
} from "./quyTacKhachHang.js";

const DOANH_NGHIEP = {
  id: 16,
  maKhachHang: "KH016",
  tenKhachHang: "Công ty TNHH Thời trang Minh Khôi",
  loaiKhachHang: "doanh_nghiep",
  nguoiLienHe: "Trần Thị Mai",
  soDienThoai: "0912345678",
  email: "muahang@minhkhoi.example.vn",
  diaChi: "88 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
  trangThai: 1,
};
const SHOPIFY = {
  id: 29,
  maKhachHang: "KH-SP-414491",
  tenKhachHang: "Nguyễn Anh",
  loaiKhachHang: null,
  nguoiLienHe: null,
  soDienThoai: "0900000000",
  email: "nguyenxuanphananh@gmail.com",
  diaChi: null,
  trangThai: 1,
};

const them = (sua) => ({ ...FORM_THEM, ...sua });

test("số điện thoại: bỏ dấu cách, chấm, gạch, ngoặc; +84 đổi về 0; tối đa 11 số", () => {
  assert.equal(chuanHoaSoDienThoaiKhiNhap("0912 345 678"), "0912345678");
  assert.equal(chuanHoaSoDienThoaiKhiNhap("+84 912.345-678"), "0912345678");
  assert.equal(chuanHoaSoDienThoaiKhiNhap("(0236) 3888-999"), "02363888999");
  assert.equal(chuanHoaSoDienThoaiKhiNhap("0236388899912"), "02363888999");
  assert.equal(chuanHoaSoDienThoaiKhiNhap("abc"), "");
});

test("mã nhập tay: viết hoa, bỏ khoảng trắng", () => {
  assert.equal(chuanHoaMaKhiNhap(" kh 0023 "), "KH0023");
});

test("mở form sửa: giữ nguyên dữ liệu đang lưu; khách chưa phân loại không chọn sẵn loại", () => {
  const form = formTuKhachHang(SHOPIFY);
  assert.equal(form.loaiKhachHang, "");
  assert.equal(form.nguoiLienHe, "");
  assert.equal(form.diaChi, "");
  assert.deepEqual(cacOThayDoi(form, form), []);
  assert.equal(formTuKhachHang({ ...SHOPIFY, loaiKhachHang: "vip" }).loaiKhachHang, "");
  assert.equal(formTuKhachHang(DOANH_NGHIEP).loaiKhachHang, "doanh_nghiep");
  // Số cũ dạng +84 vẫn để nguyên khi mở, nên mở form không bị tính là đã sửa
  assert.equal(formTuKhachHang({ ...SHOPIFY, soDienThoai: "+84900000000" }).soDienThoai, "+84900000000");
});

test("form thêm chọn sẵn Khách lẻ, chưa nhập gì thì không hỏi trước khi đóng", () => {
  assert.equal(formTuKhachHang(null).loaiKhachHang, "le");
  assert.equal(formThemCoNhap(FORM_THEM), false);
  assert.equal(formThemCoNhap(them({ tenKhachHang: " " })), false);
  assert.equal(formThemCoNhap(them({ loaiKhachHang: "si" })), true);
  assert.equal(formThemCoNhap(them({ email: "a@b.vn" })), true);
});

test("gợi ý tên, người liên hệ, nhãn địa chỉ đổi theo loại khách", () => {
  assert.match(goiYTen("le"), /Nguyễn Văn An/);
  assert.match(goiYTen(""), /Nguyễn Văn An/);
  assert.match(goiYTen("si"), /Cửa hàng/);
  assert.match(goiYTen("doanh_nghiep"), /Công ty/);
  assert.equal(hienNguoiLienHe(them({ loaiKhachHang: "le" }), FORM_THEM), false);
  assert.equal(hienNguoiLienHe(them({ loaiKhachHang: "si" }), FORM_THEM), true);
  assert.equal(hienNguoiLienHe(them({ loaiKhachHang: "doanh_nghiep" }), FORM_THEM), true);
  // Đã có người liên hệ thì đổi sang Khách lẻ vẫn còn ô (không mất dữ liệu)
  const dn = formTuKhachHang(DOANH_NGHIEP);
  assert.equal(hienNguoiLienHe({ ...dn, loaiKhachHang: "le", nguoiLienHe: "" }, dn), true);
  assert.equal(nhanDiaChi("doanh_nghiep"), "Địa chỉ trụ sở");
  assert.equal(nhanDiaChi("le"), "Địa chỉ giao hàng");
  assert.equal(nhanDiaChi(""), "Địa chỉ giao hàng");
});

test("thêm: tên bắt buộc, cần số điện thoại hoặc email", () => {
  const loi = kiemTraForm(FORM_THEM);
  assert.equal(loi.tenKhachHang, "Nhập tên khách hàng");
  assert.equal(loi.soDienThoai, CAN_LIEN_HE);
  assert.deepEqual(kiemTraForm(them({ tenKhachHang: "Shop Hoa Mai", email: "hoamai@shop.vn" })), {});
  assert.deepEqual(kiemTraForm(them({ tenKhachHang: "Shop Hoa Mai", soDienThoai: "0912345678" })), {});
});

test("số điện thoại nhận di động, máy bàn, tổng đài; sai thì báo câu rõ ràng", () => {
  const ok = (soDienThoai) => kiemTraForm(them({ tenKhachHang: "A", soDienThoai })).soDienThoai;
  assert.equal(ok("0912345678"), undefined);
  assert.equal(ok("0359876543"), undefined);
  assert.equal(ok("02363888999"), undefined);
  assert.equal(ok("19001234"), undefined);
  assert.equal(ok("1800123456"), undefined);
  assert.equal(ok("0123456789"), SO_DIEN_THOAI_MESSAGE);
  assert.equal(ok("091234567"), SO_DIEN_THOAI_MESSAGE);
  assert.equal(ok("0236388899"), SO_DIEN_THOAI_MESSAGE);
});

test("email, mã nhập tay, độ dài tối đa", () => {
  const loi = kiemTraForm(them({
    tenKhachHang: "x".repeat(201),
    maKhachHang: "KH 01",
    nguoiLienHe: "y".repeat(101),
    email: "hoamai@shop",
    diaChi: "z".repeat(501),
  }));
  assert.equal(loi.tenKhachHang, "Tên khách hàng tối đa 200 ký tự");
  assert.equal(loi.maKhachHang, "Mã chỉ gồm chữ không dấu, số và . _ -");
  assert.equal(loi.nguoiLienHe, "Người liên hệ tối đa 100 ký tự");
  assert.equal(loi.email, "Email chưa đúng, VD: ten@congty.vn");
  assert.equal(loi.diaChi, "Địa chỉ tối đa 500 ký tự");
  assert.equal(kiemTraForm(them({ tenKhachHang: "A", email: "a@b.vn", maKhachHang: "KH-CU_01.2" })).maKhachHang, undefined);
  assert.equal(kiemTraForm(them({ tenKhachHang: "A", email: "a@b.vn", maKhachHang: "KHÁCH01" })).maKhachHang,
    "Mã chỉ gồm chữ không dấu, số và . _ -");
});

test("sửa: dữ liệu cũ không đổi thì không kiểm lại; không kiểm mã", () => {
  const cu = formTuKhachHang({ ...SHOPIFY, soDienThoai: "+84900000000", email: "cu@@email", maKhachHang: "KH CŨ" });
  assert.deepEqual(kiemTraForm({ ...cu, tenKhachHang: "Nguyễn Anh Mới" }, { laSua: true, banDau: cu }), {});
  // Đổi số thì phải đúng định dạng
  assert.equal(kiemTraForm({ ...cu, soDienThoai: "0900" }, { laSua: true, banDau: cu }).soDienThoai, SO_DIEN_THOAI_MESSAGE);
});

test("sửa: xóa hết số điện thoại lẫn email thì chặn; khách vốn không có cả hai thì vẫn lưu được", () => {
  const dn = formTuKhachHang(DOANH_NGHIEP);
  assert.equal(kiemTraForm({ ...dn, soDienThoai: "", email: " " }, { laSua: true, banDau: dn }).soDienThoai, CAN_LIEN_HE);
  assert.deepEqual(kiemTraForm({ ...dn, soDienThoai: "" }, { laSua: true, banDau: dn }), {});
  const khongLienHe = formTuKhachHang({ ...SHOPIFY, soDienThoai: null, email: null });
  assert.deepEqual(kiemTraForm({ ...khongLienHe, loaiKhachHang: "si" }, { laSua: true, banDau: khongLienHe }), {});
});

test("sửa: địa chỉ cũ dài hơn 500 ký tự không chặn khi sửa ô khác", () => {
  const dai = formTuKhachHang({ ...DOANH_NGHIEP, diaChi: "x".repeat(600) });
  assert.deepEqual(kiemTraForm({ ...dai, tenKhachHang: "Mới" }, { laSua: true, banDau: dai }), {});
  assert.equal(kiemTraForm({ ...dai, diaChi: "y".repeat(600) }, { laSua: true, banDau: dai }).diaChi, "Địa chỉ tối đa 500 ký tự");
});

test("các ô đã sửa: bỏ khoảng trắng hai đầu, theo thứ tự trên màn hình, không tính mã", () => {
  const dn = formTuKhachHang(DOANH_NGHIEP);
  assert.deepEqual(cacOThayDoi({ ...dn, tenKhachHang: `  ${dn.tenKhachHang} ` }, dn), []);
  assert.deepEqual(cacOThayDoi({ ...dn, diaChi: "Mới", soDienThoai: "0905999888", maKhachHang: "X" }, dn), ["soDienThoai", "diaChi"]);
});

test("payload thêm: ô trống gửi null, mã trống để máy chủ tự tạo", () => {
  assert.deepEqual(payloadThem(them({ tenKhachHang: "  Shop Hoa Mai ", email: " hoamai@shop.vn ", loaiKhachHang: "si" })), {
    maKhachHang: null,
    tenKhachHang: "Shop Hoa Mai",
    loaiKhachHang: "si",
    maSoThue: null,
    nguoiLienHe: null,
    soDienThoai: null,
    email: "hoamai@shop.vn",
    diaChi: null,
  });
  assert.equal(payloadThem(them({ tenKhachHang: "A", maKhachHang: "KH-CU-01" })).maKhachHang, "KH-CU-01");
});

test("payload sửa: chỉ gửi ô đã đổi, xóa ô gửi chuỗi rỗng, không bao giờ gửi trạng thái", () => {
  const dn = formTuKhachHang(DOANH_NGHIEP);
  assert.deepEqual(payloadSua({ ...dn, soDienThoai: "0905999888", nguoiLienHe: "  " }, dn), {
    nguoiLienHe: "",
    soDienThoai: "0905999888",
  });
  assert.deepEqual(payloadSua(dn, dn), {});
  const sp = formTuKhachHang(SHOPIFY);
  // Khách chưa phân loại: không chọn loại thì không gửi loại (giữ "Chưa phân loại")
  assert.deepEqual(payloadSua({ ...sp, diaChi: "27 Trần Phú" }, sp), { diaChi: "27 Trần Phú" });
  assert.deepEqual(payloadSua({ ...sp, loaiKhachHang: "le" }, sp), { loaiKhachHang: "le" });
  assert.equal("trangThai" in payloadSua({ ...dn, tenKhachHang: "Mới" }, dn), false);
});

test("lỗi máy chủ được đặt vào đúng ô", () => {
  assert.equal(oCuaThongBaoMayChu("Mã khách hàng KH001 đã được dùng"), "maKhachHang");
  assert.equal(oCuaThongBaoMayChu("Tên khách hàng là bắt buộc"), "tenKhachHang");
  assert.equal(oCuaThongBaoMayChu("Người liên hệ tối đa 100 ký tự"), "nguoiLienHe");
  assert.equal(oCuaThongBaoMayChu("Số điện thoại đã thuộc khách hàng Nguyễn Văn A (KH001)"), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu(CAN_LIEN_HE), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu("Email đã thuộc khách hàng Nguyễn Văn A (KH001)"), "email");
  assert.equal(oCuaThongBaoMayChu("Email không hợp lệ"), "email");
  assert.equal(oCuaThongBaoMayChu("Địa chỉ tối đa 500 ký tự"), "diaChi");
  assert.equal(oCuaThongBaoMayChu("Loại khách hàng không hợp lệ"), "loaiKhachHang");
  assert.equal(oCuaThongBaoMayChu("Lỗi máy chủ"), null);
  assert.equal(oCuaThongBaoMayChu(undefined), null);
});

test("báo trùng: nêu tên và mã khách đang dùng", () => {
  const khach = { tenKhachHang: "Cửa hàng Thời trang An Phát", maKhachHang: "KH0023" };
  assert.equal(thongBaoTrung("soDienThoai", khach), "Số này đã thuộc khách hàng Cửa hàng Thời trang An Phát (KH0023)");
  assert.equal(thongBaoTrung("email", khach), "Email này đã thuộc khách hàng Cửa hàng Thời trang An Phát (KH0023)");
});

test("chỉ kiểm trùng khi có giá trị hợp lệ và (khi sửa) đã đổi", () => {
  assert.equal(canKiemTrung("soDienThoai", them({ soDienThoai: "0935246810" })), true);
  assert.equal(canKiemTrung("soDienThoai", them({ soDienThoai: "0935" })), false);
  assert.equal(canKiemTrung("email", them({ email: "" })), false);
  const dn = formTuKhachHang(DOANH_NGHIEP);
  assert.equal(canKiemTrung("soDienThoai", dn, { laSua: true, banDau: dn }), false);
  assert.equal(canKiemTrung("email", { ...dn, email: "moi@minhkhoi.vn" }, { laSua: true, banDau: dn }), true);
});

test("mã số thuế: hiện với khách sỉ / doanh nghiệp, nhận 10 số, 10-3 số hoặc 12 số như máy chủ", () => {
  assert.equal(hienMaSoThue(them({ loaiKhachHang: "le" }), FORM_THEM), false);
  assert.equal(hienMaSoThue(them({ loaiKhachHang: "si" }), FORM_THEM), true);
  assert.equal(hienMaSoThue(them({ loaiKhachHang: "le" }), { ...FORM_THEM, maSoThue: "0312345678" }), true);
  const dn = them({ tenKhachHang: "Công ty A", email: "a@congty.vn", loaiKhachHang: "doanh_nghiep" });
  assert.deepEqual(kiemTraForm({ ...dn, maSoThue: "0312345678" }), {});
  assert.deepEqual(kiemTraForm({ ...dn, maSoThue: "0312345678-001" }), {});
  assert.deepEqual(kiemTraForm({ ...dn, maSoThue: "001203004567" }), {});
  assert.equal(kiemTraForm({ ...dn, maSoThue: "03123" }).maSoThue, MA_SO_THUE_MESSAGE);
  // Sửa: mã cũ sai định dạng không chặn việc sửa ô khác
  const cu = formTuKhachHang({ ...DOANH_NGHIEP, maSoThue: "123" });
  assert.deepEqual(kiemTraForm({ ...cu, tenKhachHang: "Tên mới" }, { laSua: true, banDau: cu }), {});
  assert.equal(chuanHoaMaSoThueKhiNhap(" 0312.345.678-001 "), "0312345678-001");
  assert.equal(oCuaThongBaoMayChu(MA_SO_THUE_MESSAGE), "maSoThue");
  assert.equal(payloadThem({ ...dn, maSoThue: " 0312345678 " }).maSoThue, "0312345678");
});

test("mã số thuế dán vào: hàm chuẩn hóa tự giới hạn độ dài sau khi bỏ dấu (ô nhập không đặt maxLength)", () => {
  // Ô nhập không đặt maxLength: trình duyệt cắt "0312.345.678-001" (16 ký tự) còn 14 trước khi bỏ dấu chấm
  assert.equal(chuanHoaMaSoThueKhiNhap("0312.345.678-001"), "0312345678-001");
  assert.equal(chuanHoaMaSoThueKhiNhap("MST: 0312 345 678-001"), "0312345678-001");
  assert.equal(chuanHoaMaSoThueKhiNhap("0312345678-001999").length, 14);
  assert.deepEqual(
    kiemTraForm(them({ tenKhachHang: "Công ty A", email: "a@congty.vn", maSoThue: chuanHoaMaSoThueKhiNhap("0312.345.678-001") })),
    {},
  );
});
