// Chạy: node --test src/components/nhap-kho/phieu-nhap-chuyen-kho/tinhPhieuNhapChuyenKho.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { dungBangChungTu } from "../../chung-tu/bangChungTu.js";
import {
  LOAI_PHIEU_NHAP,
  cauChoNhap,
  demLo,
  dongPhieuNhap,
  loCuaDong,
  loaiPhieuNhap,
  moTaXacNhan,
  quyTacPhieuNhap,
} from "./tinhPhieuNhapChuyenKho.js";

const chuyenKho = (trangThai = 0) => ({
  id: 211, soPhieuNhap: "PN-TRF-202610211", phieuXuatGocId: 201, loaiNhap: "Chuyển kho nội bộ",
  tenKho: "Cửa hàng Hà Nội", tenKhoChuyenTu: "Kho tổng", trangThai,
});
const hoanTra = (trangThai = 0) => ({
  id: 212, soPhieuNhap: "PN-RET-202610212", phieuXuatGocId: 201, loaiNhap: "Nhập hoàn trả (Hủy chuyển kho)", tenKho: "Kho tổng", trangThai,
});
const khachTra = (trangThai = 0) => ({ id: 215, soPhieuNhap: "PN-RET-202610215", loaiNhap: "Chuyển kho nội bộ", tenKho: "Cửa hàng Hà Nội", trangThai });

test("loaiPhieuNhap giữ quy tắc màn cũ", () => {
  assert.equal(loaiPhieuNhap(chuyenKho()), LOAI_PHIEU_NHAP.CHUYEN_KHO);
  assert.equal(loaiPhieuNhap(hoanTra()), LOAI_PHIEU_NHAP.HOAN_TRA);
  assert.equal(loaiPhieuNhap({ ...hoanTra(), loaiNhap: null }), LOAI_PHIEU_NHAP.HOAN_TRA);
  assert.equal(loaiPhieuNhap({ ...chuyenKho(), soPhieuNhap: "PN-TRF-1", loaiNhap: "Nhập Hoàn Trả" }), LOAI_PHIEU_NHAP.HOAN_TRA);
  // Backend trả nhầm "Chuyển kho nội bộ" cho phiếu khách trả: nhận theo việc không có phiếu chuyển gốc
  assert.equal(loaiPhieuNhap(khachTra()), LOAI_PHIEU_NHAP.KHACH_TRA);
  assert.equal(loaiPhieuNhap(null), LOAI_PHIEU_NHAP.KHACH_TRA);
});

test("quyTacPhieuNhap: phiếu của phiếu chuyển kho chỉ xem, khách trả xác nhận nhập", () => {
  // Máy chủ lập PN-TRF / PN-RET khi nhận hàng ở phiếu chuyển: không nhận, không hủy ở đây
  const ck = quyTacPhieuNhap(chuyenKho());
  assert.equal(ck.apiNhan, null);
  assert.equal(ck.huyDuoc, false);
  assert.equal(ck.nhanNut, null);
  assert.equal(ck.moPhieuChuyen, true);
  const ht = quyTacPhieuNhap(hoanTra());
  assert.equal(ht.apiNhan, null);
  assert.equal(ht.moPhieuChuyen, true);
  const kh = quyTacPhieuNhap(khachTra());
  assert.equal(kh.apiNhan, "complete");
  assert.equal(kh.huyDuoc, false);
  assert.equal(kh.moPhieuChuyen, false);
  assert.equal(kh.nhanNut, "Xác nhận nhập trả");
  assert.equal(kh.tieuDeHop, "Xác nhận nhập trả kho");
  assert.equal(kh.cauThanhCong, "Đã nhập kho hoàn trả");
  assert.equal(quyTacPhieuNhap(chuyenKho(3)).choNhap, false);
  assert.equal(quyTacPhieuNhap(chuyenKho(3)).moPhieuChuyen, false);
  assert.equal(quyTacPhieuNhap(chuyenKho(3)).inDuoc, true);
  assert.equal(quyTacPhieuNhap(chuyenKho(4)).inDuoc, false);
  assert.equal(quyTacPhieuNhap(chuyenKho(4)).daHuy, true);
});

test("cauChoNhap và moTaXacNhan theo loại", () => {
  assert.match(cauChoNhap(chuyenKho()), /cách cũ\. Nhận hàng ở màn phiếu chuyển kho/);
  assert.match(cauChoNhap(hoanTra()), /hoàn trả về Kho tổng ở màn phiếu chuyển kho/);
  assert.match(cauChoNhap(khachTra()), /đúng lô đã bán/);
  const tong = { soSanPham: 2, soDong: 3, soLuong: 1240 };
  assert.equal(
    moTaXacNhan(khachTra(), tong, 4),
    "Cộng lại 2 sản phẩm, 3 biến thể (tổng số lượng 1.240, 4 lô) vào tồn Cửa hàng Hà Nội theo đúng lô đã bán.",
  );
  assert.equal(moTaXacNhan({}, tong), "Cộng lại 2 sản phẩm, 3 biến thể (tổng số lượng 1.240) vào tồn kho nhận theo đúng lô đã bán.");
});

test("loCuaDong: một lô ghi số của dòng, nhiều lô chỉ ghi mã (số của API là số nhập ban đầu của lô)", () => {
  assert.deepEqual(loCuaDong([{ maLo: "L1", soLuongNhap: 100 }], "6.00"), [{ maLo: "L1", soLuong: 6 }]);
  assert.deepEqual(loCuaDong([{ maLo: "L1", soLuongNhap: 100 }, { maLo: "L1", soLuongNhap: 100 }], 6), [{ maLo: "L1", soLuong: 6 }]);
  assert.deepEqual(loCuaDong([{ maLo: "L1", soLuongNhap: 4 }, { maLo: "L2", soLuongNhap: 2 }], 6), [{ maLo: "L1" }, { maLo: "L2" }]);
  assert.deepEqual(loCuaDong([{ maLo: " " }, null], 6), []);
  assert.deepEqual(loCuaDong(null, 6), []);
});

test("dongPhieuNhap: mã màu, ảnh và id sản phẩm của máy chủ mới", () => {
  const [d] = dongPhieuNhap([{ bienTheSanPhamId: 3, sanPhamId: 51, tenBienThe: "Áo Khoác", mauSac: "Đen", maMauHex: "#111111", kichCo: "S", anh: "a.jpg", sku: "AK-S", soLuongCanNhap: 2 }]);
  assert.equal(d.khoaNhom, 51);
  assert.equal(d.maMauHex, "#111111");
  assert.equal(d.kichCo, "S");
  assert.equal(d.anh, "a.jpg");
  const [cu] = dongPhieuNhap([{ bienTheSanPhamId: 3, tenBienThe: "Áo Khoác", mauSac: "Đen" }]);
  assert.equal(cu.khoaNhom, null);
  assert.equal(cu.maMauHex, "");
  assert.equal(cu.anh, null);
});

test("dongPhieuNhap: trạng thái lô, gom theo sản phẩm, tìm theo mã lô, đếm lô", () => {
  const items = [
    { bienTheSanPhamId: 7, sku: "QJ-21", tenBienThe: "Quần Jeans", mauSac: "Xanh Than", kichCo: "21", soLuongCanNhap: "10.00" },
    { bienTheSanPhamId: 8, sku: "QJ-22", tenBienThe: "Quần Jeans", mauSac: "Xanh Than", kichCo: "22", soLuongCanNhap: 8 },
    { bienTheSanPhamId: 9, sku: "AK-M", tenBienThe: "Áo Khoác", mauSac: null, kichCo: null, soLuongCanNhap: 6 },
  ];
  const dangTai = dongPhieuNhap(items);
  assert.deepEqual(dangTai.map((d) => d.trangThaiLo), ["dangTai", "dangTai", "dangTai"]);
  assert.equal(demLo(dangTai), null);

  const lo = { 7: [{ maLo: "L2610170019", soLuongNhap: 50 }, { maLo: "L2610190022", soLuongNhap: 40 }], 8: [{ maLo: "L2610170020" }], 9: null };
  const dong = dongPhieuNhap(items, lo);
  assert.deepEqual(dong.map((d) => d.trangThaiLo), ["co", "co", "loi"]);
  assert.deepEqual(dong[1].lo, [{ maLo: "L2610170020", soLuong: 8 }]);
  assert.equal(dong[2].tenMau, "");
  assert.equal(demLo(dong), null);
  assert.equal(demLo(dongPhieuNhap(items.slice(0, 2), lo)), 3);
  assert.equal(demLo([]), 0);

  const bang = dungBangChungTu(dong, { tuKhoa: "l26101900" });
  assert.equal(bang.ketQua.soDong, 1);
  assert.equal(dungBangChungTu(dong).tong.soSanPham, 2);
  assert.equal(dungBangChungTu(dong).tong.soLuong, 24);
  assert.deepEqual(dongPhieuNhap(undefined), []);
});
