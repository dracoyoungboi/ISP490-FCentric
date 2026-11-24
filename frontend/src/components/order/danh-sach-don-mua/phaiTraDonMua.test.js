// Chạy: node --test src/components/order/danh-sach-don-mua/phaiTraDonMua.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { coTheTaoPhieuNhap, tomTatPhaiTra } from "./phaiTraDonMua.js";

test("Đơn đã trừ hàng lỗi: số là phải trả của máy chủ, có hộp cách tính", () => {
  const tt = tomTatPhaiTra({
    trangThai: 5, tongTien: 950000, phaiTra: 660000, tienTheoDat: 950000, giamTruLoi: 290000, soLoiTruTien: 3,
    khongGiao: 0, soKhongGiao: 0, soLoiChoChot: 0,
  });
  assert.equal(tt.phaiTra, 660000);
  assert.equal(tt.coChiTiet, true);
  assert.equal(tt.tienTheoDat, 950000);
  assert.equal(tt.giamTruLoi, 290000);
  assert.equal(tt.soLoiTruTien, 3);
});

test("Đơn bình thường: chỉ số, không bấm được", () => {
  const tt = tomTatPhaiTra({ trangThai: 5, tongTien: 1000000, phaiTra: 1000000, giamTruLoi: 0, khongGiao: 0, soLoiChoChot: 0 });
  assert.equal(tt.phaiTra, 1000000);
  assert.equal(tt.coChiTiet, false);
});

test("Đóng thiếu / còn lỗi chưa chốt: bấm được", () => {
  assert.equal(tomTatPhaiTra({ trangThai: 6, phaiTra: 1200000, khongGiao: 800000, soKhongGiao: 8 }).coChiTiet, true);
  const cho = tomTatPhaiTra({ trangThai: 3, phaiTra: 1500000, soLoiChoChot: "2" });
  assert.equal(cho.coChiTiet, true);
  assert.equal(cho.soLoiChoChot, 2);
});

test("Đơn đã hủy: không có số (hiện —)", () => {
  assert.deepEqual(tomTatPhaiTra({ trangThai: 7, tongTien: 3000000, phaiTra: null }), { phaiTra: null, coChiTiet: false });
});

test("Máy chủ cũ chưa có phaiTra: lấy tổng tiền, không mở hộp", () => {
  const tt = tomTatPhaiTra({ trangThai: 3, tongTien: "900000.00" });
  assert.equal(tt.phaiTra, 900000);
  assert.equal(tt.coChiTiet, false);
  assert.equal(tomTatPhaiTra({ trangThai: 3 }).phaiTra, null);
});

test("Nút Tạo phiếu nhập kho chỉ ở đơn Đang vận chuyển", () => {
  assert.equal(coTheTaoPhieuNhap({ trangThai: 3 }), true);
  assert.equal(coTheTaoPhieuNhap({ trangThai: "3" }), true);
  for (const tt of [2, 4, 5, 6, 7, null]) assert.equal(coTheTaoPhieuNhap({ trangThai: tt }), false, String(tt));
});
