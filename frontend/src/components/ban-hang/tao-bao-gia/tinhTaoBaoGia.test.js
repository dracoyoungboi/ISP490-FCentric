// Chạy: node --test src/components/ban-hang/tao-bao-gia/tinhTaoBaoGia.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chonKhiEnter,
  chuanHoaDong,
  docOSoLuong,
  docOTien,
  idBaoGiaMoi,
  khoangGia,
  kiemTraDonGia,
  locKhach,
  lyDoKhoaLuu,
  SO_LUONG_TOI_DA,
  taoBodyBaoGia,
  timBienThe,
} from "./tinhTaoBaoGia.js";

const BIEN_THE = [
  { id: 101, sanPhamId: 1, tenSanPham: "Áo Khoác Phối Lót Lông", maBienThe: "AK-KEM-M", maVachSku: "8936210510431", tenMau: "Kem", tenSize: "M", giaBan: 120000 },
  { id: 102, sanPhamId: 1, tenSanPham: "Áo Khoác Phối Lót Lông", maBienThe: "AK-KEM-L", maVachSku: "8936210510432", tenMau: "Kem", tenSize: "L", giaBan: 120000 },
  { id: 201, sanPhamId: 2, tenSanPham: "Quần Jean Ống Suông", maBienThe: "QJ-XN-29", maVachSku: "8936210520291", tenMau: "Xanh nhạt", tenSize: "29", giaBan: 385000 },
  { id: 501, sanPhamId: 5, tenSanPham: "Túi Tote Canvas", maBienThe: "TT2607003", maVachSku: "", tenMau: null, tenSize: null, tenChatLieu: "Canvas", giaBan: 159000 },
];

const KHACH = [
  { id: 1, maKhachHang: "KH0001", tenKhachHang: "Công ty TNHH Thời trang An Nhiên", soDienThoai: "0912345678", diaChi: "12 Nguyễn Trãi" },
  { id: 2, maKhachHang: "KH0002", tenKhachHang: "Shop Mộc Miên", soDienThoai: "0987654321", diaChi: "45 Hàng Bông" },
  { id: 3, maKhachHang: "KH0003", tenKhachHang: "Nguyễn Thị Lan", soDienThoai: "0905112233", diaChi: "" },
];

test("khoangGia: 90%–110%, làm tròn vào trong khoảng như máy chủ", () => {
  assert.deepEqual(khoangGia(120000), { toiThieu: 108000, toiDa: 132000 });
  assert.deepEqual(khoangGia("120000.00"), { toiThieu: 108000, toiDa: 132000 });
  // 99.999 × 0,9 = 89.999,1 → 90.000; × 1,1 = 109.998,9 → 109.998
  assert.deepEqual(khoangGia(99999), { toiThieu: 90000, toiDa: 109998 });
  // Không cộng thêm 1 vì sai số dấu phẩy động
  assert.deepEqual(khoangGia(385000), { toiThieu: 346500, toiDa: 423500 });
  assert.deepEqual(khoangGia(null), { toiThieu: 0, toiDa: 0 });
});

test("kiemTraDonGia: trống, thấp, cao, đúng mép, phần trăm lệch", () => {
  assert.equal(kiemTraDonGia("", 120000).loi, "trong");
  assert.equal(kiemTraDonGia(null, 120000).loi, "trong");
  assert.equal(kiemTraDonGia(107999, 120000).loi, "thap");
  assert.equal(kiemTraDonGia(108000, 120000).loi, null);
  assert.equal(kiemTraDonGia(132000, 120000).loi, null);
  assert.equal(kiemTraDonGia(132001, 120000).loi, "cao");
  assert.equal(kiemTraDonGia(114000, 120000).lech, -5);
  assert.equal(kiemTraDonGia(375000, 385000).lech, -2.6);
  assert.equal(kiemTraDonGia(120000, 120000).lech, 0);
  assert.equal(kiemTraDonGia(100000, 120000).toiThieu, 108000);
  // Biến thể chưa có giá niêm yết (0 / null): không có khoảng để so, máy chủ chặn
  assert.equal(kiemTraDonGia(150000, 0).loi, "chuaCoGia");
  assert.equal(kiemTraDonGia(0, "0.00").loi, "chuaCoGia");
  assert.equal(kiemTraDonGia(150000, null).loi, "chuaCoGia");
});

test("docOTien: chỉ giữ chữ số, bỏ số 0 đầu, trống thành chuỗi rỗng", () => {
  assert.equal(docOTien("120.000"), 120000);
  assert.equal(docOTien("120.000 ₫"), 120000);
  assert.equal(docOTien("00450"), 450);
  assert.equal(docOTien("0"), 0);
  assert.equal(docOTien(""), "");
  assert.equal(docOTien("abc"), "");
  assert.equal(docOTien("9".repeat(20)), 999999999999);
});

test("docOSoLuong: chỉ số nguyên dương, ký tự lạ thì giữ số cũ (undefined)", () => {
  assert.equal(docOSoLuong("12"), 12);
  assert.equal(docOSoLuong(" 3 "), 3);
  assert.equal(docOSoLuong(""), "");
  assert.equal(docOSoLuong("3.5"), undefined);
  assert.equal(docOSoLuong("3,5"), undefined);
  assert.equal(docOSoLuong("-2"), undefined);
  assert.equal(docOSoLuong("2a"), undefined);
  assert.equal(docOSoLuong("0"), 0);
  assert.equal(docOSoLuong("1000000"), SO_LUONG_TOI_DA);
});

test("timBienThe: không dấu, mọi từ phải có, giới hạn số gợi ý", () => {
  assert.deepEqual(timBienThe(BIEN_THE, "ao khoac kem").ds.map((v) => v.id), [101, 102]);
  assert.deepEqual(timBienThe(BIEN_THE, "ao khoac l").ds.map((v) => v.id), [102]);
  assert.deepEqual(timBienThe(BIEN_THE, "canvas").ds.map((v) => v.id), [501]);
  assert.deepEqual(timBienThe(BIEN_THE, "8936210520291").ds.map((v) => v.id), [201]);
  assert.equal(timBienThe(BIEN_THE, "khong co").tong, 0);
  const dau = timBienThe(BIEN_THE, "", 2);
  assert.equal(dau.ds.length, 2);
  assert.equal(dau.tong, 4);
  assert.equal(timBienThe(null, "ao").tong, 0);
});

test("chonKhiEnter: trùng SKU / mã vạch, đúng một kết quả, nhiều, không có", () => {
  assert.equal(chonKhiEnter(BIEN_THE, "qj-xn-29").bienThe.id, 201);
  assert.equal(chonKhiEnter(BIEN_THE, "8936210510432").bienThe.id, 102);
  assert.equal(chonKhiEnter(BIEN_THE, "tui tote").bienThe.id, 501);
  assert.deepEqual(chonKhiEnter(BIEN_THE, "ao khoac"), { loi: "nhieu" });
  assert.deepEqual(chonKhiEnter(BIEN_THE, "zzz"), { loi: "khong" });
  assert.equal(chonKhiEnter(BIEN_THE, "   "), null);
});

test("locKhach: theo tên không dấu, mã khách, SĐT từ 3 chữ số", () => {
  assert.deepEqual(locKhach(KHACH, "moc mien").map((k) => k.id), [2]);
  assert.deepEqual(locKhach(KHACH, "KH0003").map((k) => k.id), [3]);
  assert.deepEqual(locKhach(KHACH, "0905").map((k) => k.id), [3]);
  assert.deepEqual(locKhach(KHACH, "0912 345").map((k) => k.id), [1]);
  assert.deepEqual(locKhach(KHACH, "09").map((k) => k.id), []);
  assert.equal(locKhach(KHACH, "", 2).length, 2);
  // Từ 1–2 ký tự khớp đầu từ (gõ dở tên vẫn ra), không khớp giữa từ
  assert.deepEqual(locKhach(KHACH, "ng").map((k) => k.id), [3]);
  assert.deepEqual(locKhach(KHACH, "tr").map((k) => k.id), [1]);
  assert.deepEqual(locKhach(KHACH, "n").map((k) => k.id), [1, 3]);
  // Từ khóa có chữ thì không dò số điện thoại ("Shop 654" không ra khách chỉ vì SĐT có 654)
  assert.deepEqual(locKhach(KHACH, "an 654").map((k) => k.id), []);
  assert.deepEqual(locKhach(KHACH, "654").map((k) => k.id), [2]);
});

test("chuanHoaDong: số lượng trống / 0 thành 1, đơn giá trống thành giá niêm yết", () => {
  const d = { bienTheId: 1, giaNiemYet: 120000 };
  assert.deepEqual(chuanHoaDong({ ...d, soLuong: "", donGia: "" }), { ...d, soLuong: 1, donGia: 120000 });
  assert.deepEqual(chuanHoaDong({ ...d, soLuong: 0, donGia: 114000 }), { ...d, soLuong: 1, donGia: 114000 });
  assert.deepEqual(chuanHoaDong({ ...d, soLuong: 3, donGia: 0 }), { ...d, soLuong: 3, donGia: 0 });
});

test("lyDoKhoaLuu: theo thứ tự tải, khách, sản phẩm, giá sai, giá trống, số lượng", () => {
  const dongDung = { donGia: 120000, giaNiemYet: 120000, soLuong: 1 };
  assert.equal(lyDoKhoaLuu({ dangTai: true }), "Đang tải dữ liệu");
  assert.equal(lyDoKhoaLuu({ coKhach: false, dong: [dongDung] }), "Chọn khách hàng");
  assert.equal(lyDoKhoaLuu({ coKhach: true, dong: [] }), "Thêm ít nhất một sản phẩm");
  assert.equal(
    lyDoKhoaLuu({ coKhach: true, dong: [dongDung, { ...dongDung, donGia: 100000 }, { ...dongDung, donGia: "" }] }),
    "1 dòng có đơn giá ngoài khoảng cho phép",
  );
  assert.equal(lyDoKhoaLuu({ coKhach: true, dong: [dongDung, { ...dongDung, donGia: "" }] }), "1 dòng chưa nhập đơn giá");
  assert.equal(
    lyDoKhoaLuu({ coKhach: true, dong: [{ ...dongDung, giaNiemYet: 0, donGia: 0 }, { ...dongDung, donGia: 1 }] }),
    "1 sản phẩm chưa có giá niêm yết",
  );
  assert.equal(lyDoKhoaLuu({ coKhach: true, dong: [{ ...dongDung, soLuong: "" }] }), "1 dòng chưa nhập số lượng");
  assert.equal(lyDoKhoaLuu({ coKhach: true, dong: [{ ...dongDung, soLuong: 0 }] }), "1 dòng chưa nhập số lượng");
  assert.equal(lyDoKhoaLuu({ coKhach: true, dong: [dongDung] }), "");
});

test("taoBodyBaoGia: báo giá không kho, cắt khoảng trắng, số chuẩn", () => {
  const body = taoBodyBaoGia(
    { khachHangId: "2", phiVanChuyen: "", diaChiGiaoHang: "  45 Hàng Bông ", ghiChu: " Hiệu lực 7 ngày " },
    [{ bienTheId: 101, soLuong: 3, donGia: 114000 }, { bienTheId: "201", soLuong: "2", donGia: "375000" }],
  );
  assert.deepEqual(body, {
    loaiChungTu: "bao_gia",
    khachHangId: 2,
    khoXuatId: null,
    phiVanChuyen: 0,
    diaChiGiaoHang: "45 Hàng Bông",
    ghiChu: "Hiệu lực 7 ngày",
    chiTiet: [
      { bienTheSanPhamId: 101, soLuongDat: 3, donGia: 114000 },
      { bienTheSanPhamId: 201, soLuongDat: 2, donGia: 375000 },
    ],
  });
});

test("idBaoGiaMoi: đọc id từ ResponseData", () => {
  assert.equal(idBaoGiaMoi({ status: 200, data: { id: 321, soDonHang: "BG202610231" } }), 321);
  assert.equal(idBaoGiaMoi({ id: 7 }), 7);
  assert.equal(idBaoGiaMoi({ data: null }), null);
  assert.equal(idBaoGiaMoi(undefined), null);
});
