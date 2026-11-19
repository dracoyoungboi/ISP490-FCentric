import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAN_LIEN_HE,
  FORM_THEM,
  SO_DIEN_THOAI_MESSAGE,
  cacOThayDoi,
  canKiemTrung,
  chuanHoaMaKhiNhap,
  chuanHoaSoDienThoaiKhiNhap,
  formThemCoNhap,
  formTuKhachHang,
  kiemTraForm,
  loiSoDienThoai,
  loiTenKhachHang,
  oCuaThongBaoMayChu,
  payloadSua,
  payloadThem,
  thongBaoTrung,
} from "./quyTacKhachHang.js";

const KHACH = {
  id: 16,
  maKhachHang: "KH016",
  tenKhachHang: "Trần Thị Mai",
  soDienThoai: "0912345678",
  email: "mai.tran@example.vn",
  diaChi: "88 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
  trangThai: 1,
};
// Khách tạo từ đơn Shopify: thiếu địa chỉ, số lưu nguyên dạng của sàn
const SHOPIFY = {
  id: 29,
  maKhachHang: "KH-SP-414491",
  tenKhachHang: "Nguyễn Anh",
  soDienThoai: "0900000000",
  email: "anh.nguyen@example.com",
  diaChi: null,
  trangThai: 1,
};
const TEN_SAI_KY_TU = "Tên khách hàng chỉ gồm chữ cái và dấu cách";

const them = (sua) => ({ ...FORM_THEM, ...sua });

test("số điện thoại: bỏ dấu cách, chấm, gạch, ngoặc; +84 đổi về 0; không cắt ngầm", () => {
  assert.equal(chuanHoaSoDienThoaiKhiNhap("0912 345 678"), "0912345678");
  assert.equal(chuanHoaSoDienThoaiKhiNhap("+84 912.345-678"), "0912345678");
  assert.equal(chuanHoaSoDienThoaiKhiNhap("(0236) 3888-999"), "02363888999");
  // Không cắt ngầm: dán thừa chữ số thì giữ nguyên để luật kiểm báo sai
  assert.equal(chuanHoaSoDienThoaiKhiNhap("0236388899912"), "0236388899912");
  assert.equal(kiemTraForm(them({ tenKhachHang: "An", soDienThoai: "0236388899912" })).soDienThoai, SO_DIEN_THOAI_MESSAGE);
  assert.equal(chuanHoaSoDienThoaiKhiNhap("abc"), "");
});

test("mã nhập tay: viết hoa, bỏ khoảng trắng", () => {
  assert.equal(chuanHoaMaKhiNhap(" kh 0023 "), "KH0023");
});

test("mở form sửa: giữ nguyên dữ liệu đang lưu, mở ra không tính là đã sửa", () => {
  const form = formTuKhachHang(SHOPIFY);
  assert.equal(form.diaChi, "");
  assert.deepEqual(cacOThayDoi(form, form), []);
  // Số cũ dạng +84 vẫn để nguyên khi mở
  assert.equal(formTuKhachHang({ ...SHOPIFY, soDienThoai: "+84900000000" }).soDienThoai, "+84900000000");
  assert.deepEqual(Object.keys(formTuKhachHang(KHACH)), Object.keys(FORM_THEM));
});

test("form thêm chưa nhập gì thì không hỏi trước khi đóng", () => {
  assert.deepEqual(formTuKhachHang(null), FORM_THEM);
  assert.equal(formThemCoNhap(FORM_THEM), false);
  assert.equal(formThemCoNhap(them({ tenKhachHang: " " })), false);
  assert.equal(formThemCoNhap(them({ email: "a@b.vn" })), true);
});

test("thêm: tên bắt buộc, cần số điện thoại hoặc email", () => {
  const loi = kiemTraForm(FORM_THEM);
  assert.equal(loi.tenKhachHang, "Nhập tên khách hàng");
  assert.equal(loi.soDienThoai, CAN_LIEN_HE);
  assert.deepEqual(kiemTraForm(them({ tenKhachHang: "Nguyễn Thu Hà", email: "thuha@example.vn" })), {});
  assert.deepEqual(kiemTraForm(them({ tenKhachHang: "Nguyễn Thu Hà", soDienThoai: "0912345678" })), {});
});

test("tên khách là họ tên một người: chữ cái và dấu cách, 2–200 ký tự", () => {
  assert.equal(loiTenKhachHang("  Lê   Thị Hồng-Nhung "), "");
  assert.equal(loiTenKhachHang("O’Brien"), "");
  assert.equal(loiTenKhachHang("Shop A&B"), TEN_SAI_KY_TU);
  assert.equal(loiTenKhachHang("Công ty TNHH 3A"), TEN_SAI_KY_TU);
  assert.equal(loiTenKhachHang("=1+1"), TEN_SAI_KY_TU);
  assert.equal(loiTenKhachHang("A"), "Tên khách hàng cần ít nhất 2 ký tự");
  assert.equal(loiTenKhachHang(" "), "Nhập tên khách hàng");
  assert.equal(loiTenKhachHang("x".repeat(201)), "Tên khách hàng tối đa 200 ký tự");
});

test("số điện thoại: di động 10 số hoặc máy bàn 11 số, không nhận tổng đài 1800/1900", () => {
  assert.equal(loiSoDienThoai("0912345678"), "");
  assert.equal(loiSoDienThoai("0359876543"), "");
  assert.equal(loiSoDienThoai("02363888999"), "");
  for (const sai of ["19001234", "1800123456", "0123456789", "091234567", "0236388899"]) {
    assert.equal(loiSoDienThoai(sai), SO_DIEN_THOAI_MESSAGE, sai);
  }
  assert.equal(kiemTraForm(them({ tenKhachHang: "An", soDienThoai: "19001234" })).soDienThoai, SO_DIEN_THOAI_MESSAGE);
});

test("email, mã nhập tay, độ dài tối đa", () => {
  const loi = kiemTraForm(them({
    tenKhachHang: "x".repeat(201),
    maKhachHang: "KH 01",
    email: "hoamai@shop",
    diaChi: "z".repeat(501),
  }));
  assert.equal(loi.tenKhachHang, "Tên khách hàng tối đa 200 ký tự");
  assert.equal(loi.maKhachHang, "Mã gồm chữ không dấu, số và . _ -, mở đầu bằng chữ hoặc số");
  assert.equal(loi.email, "Email chưa đúng, VD: ten@congty.vn");
  assert.equal(loi.diaChi, "Địa chỉ tối đa 500 ký tự");
  assert.equal(kiemTraForm(them({ tenKhachHang: "An", email: "a@b.vn", maKhachHang: "KH-CU_01.2" })).maKhachHang, undefined);
  assert.equal(kiemTraForm(them({ tenKhachHang: "An", email: "a@b.vn", maKhachHang: "KHÁCH01" })).maKhachHang,
    "Mã gồm chữ không dấu, số và . _ -, mở đầu bằng chữ hoặc số");
});

test("sửa: dữ liệu cũ không đổi thì không kiểm lại (tên công ty, số tổng đài từ trước); không kiểm mã", () => {
  const cu = formTuKhachHang({
    ...SHOPIFY, tenKhachHang: "Công ty TNHH 3A", soDienThoai: "19001234", email: "cu@@email", maKhachHang: "KH CŨ",
  });
  assert.deepEqual(kiemTraForm({ ...cu, diaChi: "27 Trần Phú" }, { laSua: true, banDau: cu }), {});
  // Đổi ô nào thì ô đó phải đúng luật
  assert.equal(kiemTraForm({ ...cu, soDienThoai: "0900" }, { laSua: true, banDau: cu }).soDienThoai, SO_DIEN_THOAI_MESSAGE);
  assert.equal(kiemTraForm({ ...cu, tenKhachHang: "Công ty TNHH 3B" }, { laSua: true, banDau: cu }).tenKhachHang, TEN_SAI_KY_TU);
  // Xóa trắng tên thì luôn báo
  assert.equal(kiemTraForm({ ...cu, tenKhachHang: " " }, { laSua: true, banDau: cu }).tenKhachHang, "Nhập tên khách hàng");
});

test("sửa: xóa hết số điện thoại lẫn email thì chặn; khách vốn không có cả hai thì vẫn lưu được", () => {
  const k = formTuKhachHang(KHACH);
  assert.equal(kiemTraForm({ ...k, soDienThoai: "", email: " " }, { laSua: true, banDau: k }).soDienThoai, CAN_LIEN_HE);
  assert.deepEqual(kiemTraForm({ ...k, soDienThoai: "" }, { laSua: true, banDau: k }), {});
  const khongLienHe = formTuKhachHang({ ...SHOPIFY, soDienThoai: null, email: null });
  assert.deepEqual(kiemTraForm({ ...khongLienHe, diaChi: "27 Trần Phú" }, { laSua: true, banDau: khongLienHe }), {});
});

test("sửa: địa chỉ cũ dài hơn 500 ký tự không chặn khi sửa ô khác", () => {
  const dai = formTuKhachHang({ ...KHACH, diaChi: "x".repeat(600) });
  assert.deepEqual(kiemTraForm({ ...dai, tenKhachHang: "Trần Mai" }, { laSua: true, banDau: dai }), {});
  assert.equal(kiemTraForm({ ...dai, diaChi: "y".repeat(600) }, { laSua: true, banDau: dai }).diaChi, "Địa chỉ tối đa 500 ký tự");
});

test("các ô đã sửa: bỏ khoảng trắng hai đầu, theo thứ tự trên màn hình, không tính mã", () => {
  const k = formTuKhachHang(KHACH);
  assert.deepEqual(cacOThayDoi({ ...k, tenKhachHang: `  ${k.tenKhachHang} ` }, k), []);
  assert.deepEqual(cacOThayDoi({ ...k, diaChi: "Mới", soDienThoai: "0905999888", maKhachHang: "X" }, k), ["soDienThoai", "diaChi"]);
});

test("payload thêm: ô trống gửi null, mã trống để máy chủ tự tạo", () => {
  assert.deepEqual(payloadThem(them({ tenKhachHang: "  Nguyễn  Thu Hà ", email: " thuha@example.vn " })), {
    maKhachHang: null,
    tenKhachHang: "Nguyễn Thu Hà",
    soDienThoai: null,
    email: "thuha@example.vn",
    diaChi: null,
  });
  assert.equal(payloadThem(them({ tenKhachHang: "An", maKhachHang: "KH-CU-01" })).maKhachHang, "KH-CU-01");
});

test("payload sửa: chỉ gửi ô đã đổi, xóa ô gửi chuỗi rỗng, không bao giờ gửi trạng thái", () => {
  const k = formTuKhachHang(KHACH);
  assert.deepEqual(payloadSua({ ...k, soDienThoai: "0905999888", diaChi: "  " }, k), {
    soDienThoai: "0905999888",
    diaChi: "",
  });
  assert.deepEqual(payloadSua(k, k), {});
  assert.equal("trangThai" in payloadSua({ ...k, tenKhachHang: "Trần Mai" }, k), false);
});

test("lỗi máy chủ được đặt vào đúng ô", () => {
  assert.equal(oCuaThongBaoMayChu("Mã khách hàng KH001 đã được dùng"), "maKhachHang");
  assert.equal(oCuaThongBaoMayChu("Tên khách hàng là bắt buộc"), "tenKhachHang");
  assert.equal(oCuaThongBaoMayChu(TEN_SAI_KY_TU), "tenKhachHang");
  assert.equal(oCuaThongBaoMayChu(SO_DIEN_THOAI_MESSAGE), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu("Số điện thoại đã thuộc khách hàng Nguyễn Văn A (KH001)"), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu(CAN_LIEN_HE), "soDienThoai");
  assert.equal(oCuaThongBaoMayChu("Email đã thuộc khách hàng Nguyễn Văn A (KH001)"), "email");
  assert.equal(oCuaThongBaoMayChu("Email không hợp lệ"), "email");
  assert.equal(oCuaThongBaoMayChu("Địa chỉ tối đa 500 ký tự"), "diaChi");
  assert.equal(oCuaThongBaoMayChu("Lỗi máy chủ"), null);
  assert.equal(oCuaThongBaoMayChu(undefined), null);
});

test("báo trùng: nêu tên và mã khách đang dùng", () => {
  const khach = { tenKhachHang: "Trần Thị Mai", maKhachHang: "KH0023" };
  assert.equal(thongBaoTrung("soDienThoai", khach), "Số này đã thuộc khách hàng Trần Thị Mai (KH0023)");
  assert.equal(thongBaoTrung("email", khach), "Email này đã thuộc khách hàng Trần Thị Mai (KH0023)");
});

test("chỉ kiểm trùng khi có giá trị hợp lệ và (khi sửa) đã đổi", () => {
  assert.equal(canKiemTrung("soDienThoai", them({ soDienThoai: "0935246810" })), true);
  assert.equal(canKiemTrung("soDienThoai", them({ soDienThoai: "0935" })), false);
  assert.equal(canKiemTrung("soDienThoai", them({ soDienThoai: "19001234" })), false);
  assert.equal(canKiemTrung("email", them({ email: "" })), false);
  const k = formTuKhachHang(KHACH);
  assert.equal(canKiemTrung("soDienThoai", k, { laSua: true, banDau: k }), false);
  assert.equal(canKiemTrung("email", { ...k, email: "moi@example.vn" }, { laSua: true, banDau: k }), true);
});
