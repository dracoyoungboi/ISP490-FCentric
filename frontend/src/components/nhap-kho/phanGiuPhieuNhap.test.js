import { test } from "node:test";
import assert from "node:assert/strict";
import { conLaiCoTheNhap, dongDonKemPhanGiu, donMuaCoPhieuNhap, noiSoPhieu, phieuNenMo, tinhPhanGiu } from "./phanGiuPhieuNhap.js";

const phieu = (id, soPhieuNhap, trangThai, items) => ({ id, soPhieuNhap, trangThai, items });
const dong = (bienTheSanPhamId, soLuongCanNhap) => ({ bienTheSanPhamId, soLuongCanNhap });

test("tinhPhanGiu cộng số cần nhập của mọi phiếu Nháp theo biến thể (như máy chủ trừ khi tạo phiếu)", () => {
  const kq = tinhPhanGiu([
    phieu(111, "PN202610172", 0, [dong(126, 1), dong(127, 1)]),
    phieu(110, "PN202610171", 0, [dong(126, 1), dong(127, "1.000")]),
  ]);
  assert.equal(kq.theoBienThe.get(126), 2);
  assert.equal(kq.theoBienThe.get(127), 2);
  assert.equal(kq.tong, 4);
  // Chưa phiếu nào kiểm đếm: phiếu tạo trước đứng trước
  assert.deepEqual(kq.phieu, [
    { id: 110, soPhieuNhap: "PN202610171", giu: 2, daKiem: 0, bienThe: [126, 127] },
    { id: 111, soPhieuNhap: "PN202610172", giu: 2, daKiem: 0, bienThe: [126, 127] },
  ]);
});

test("tinhPhanGiu xếp phiếu đã kiểm đếm lên trước phiếu tạo trước nhưng bỏ dở", () => {
  const kq = tinhPhanGiu([
    phieu(110, "PN202610171", 0, [dong(126, 1), dong(127, 1)]),
    phieu(111, "PN202610172", 0, [{ ...dong(126, 1), soLuongDatQc: 1 }, dong(127, 1)]),
    // Lô chỉ có hàng không đạt vẫn là đã kiểm đếm
    phieu(112, "PN202610173", 0, [{ ...dong(127, 1), soLuongDatQc: 0, soLuongLoiQc: 1 }]),
    phieu(113, "PN202610174", 0, [dong(127, 1)]),
  ]);
  assert.deepEqual(kq.phieu.map((p) => [p.soPhieuNhap, p.daKiem]), [
    ["PN202610172", 1],
    ["PN202610173", 1],
    ["PN202610171", 0],
    ["PN202610174", 0],
  ]);
  const dongDon = dongDonKemPhanGiu(
    [{ bienTheSanPham: { id: 126 }, soLuongDat: 1, soLuongDaNhan: 0 }, { bienTheSanPham: { id: 127 }, soLuongDat: 1, soLuongDaNhan: 0 }],
    kq.theoBienThe,
  );
  assert.equal(phieuNenMo(kq.phieu, dongDon)?.soPhieuNhap, "PN202610172");
});

test("tinhPhanGiu và dongDonKemPhanGiu khớp id biến thể dù một bên là chuỗi", () => {
  const kq = tinhPhanGiu([phieu(1, "PN1", 0, [dong("126", 1)])]);
  assert.equal(kq.theoBienThe.get(126), 1);
  const [d] = dongDonKemPhanGiu([{ bienTheSanPham: { id: "126" }, soLuongDat: 1, soLuongDaNhan: 0 }], kq.theoBienThe);
  assert.equal(d.dangGiu, 1);
  assert.equal(d.conLai, 0);
});

test("phieuNenMo chọn phiếu tạo trước còn giữ biến thể chưa nhận đủ", () => {
  const dongDon = [
    { bienTheSanPham: { id: 126 }, thieu: 0 },
    { bienTheSanPham: { id: 127 }, thieu: 1 },
  ];
  const ds = [
    { id: 110, soPhieuNhap: "PN1", bienThe: [126] },
    { id: 111, soPhieuNhap: "PN2", bienThe: [126, 127] },
  ];
  assert.equal(phieuNenMo(ds, dongDon)?.id, 111);
  assert.equal(phieuNenMo(ds, [{ bienTheSanPham: { id: 126 }, thieu: 0 }]), null);
  assert.equal(phieuNenMo(null, dongDon), null);
});

test("tinhPhanGiu bỏ phiếu đã nhập kho, đã hủy, thiếu trạng thái và dòng không có biến thể", () => {
  const kq = tinhPhanGiu([
    phieu(1, "PN-XONG", 3, [dong(126, 5)]),
    phieu(2, "PN-HUY", 4, [dong(126, 5)]),
    phieu(3, "PN-LA", null, [dong(126, 5)]),
    phieu(4, "PN-NHAP", "0", [dong(null, 9), dong(126, 2), dong(127, 0), dong(128, -3)]),
    null,
  ]);
  assert.equal(kq.theoBienThe.get(126), 2);
  assert.equal(kq.theoBienThe.has(127), false);
  assert.equal(kq.theoBienThe.has(128), false);
  assert.deepEqual(kq.phieu, [{ id: 4, soPhieuNhap: "PN-NHAP", giu: 2, daKiem: 0, bienThe: [126] }]);
});

test("tinhPhanGiu với dữ liệu trống hoặc sai kiểu trả kết quả rỗng", () => {
  for (const vao of [undefined, null, {}, "x"]) {
    const kq = tinhPhanGiu(vao);
    assert.equal(kq.theoBienThe.size, 0);
    assert.deepEqual(kq.phieu, []);
    assert.equal(kq.tong, 0);
  }
  // Phiếu nháp không giữ gì thì không thành dòng thông báo
  assert.deepEqual(tinhPhanGiu([phieu(5, "PN-RONG", 0, [])]).phieu, []);
});

test("conLaiCoTheNhap = Đặt − Đã nhận − Đang giữ, không âm", () => {
  assert.equal(conLaiCoTheNhap(1, 0, 0), 1);
  assert.equal(conLaiCoTheNhap(1, 0, 2), 0);
  assert.equal(conLaiCoTheNhap("10.000", "3", 4), 3);
  assert.equal(conLaiCoTheNhap(5, 7), 0);
  assert.equal(conLaiCoTheNhap(undefined, null), 0);
});

test("dongDonKemPhanGiu gắn dangGiu, thieu và conLai cho từng dòng đơn", () => {
  const ds = dongDonKemPhanGiu(
    [
      { id: 1, bienTheSanPham: { id: 126 }, soLuongDat: 1, soLuongDaNhan: 0 },
      { id: 2, bienTheSanPham: { id: 129 }, soLuongDat: 3, soLuongDaNhan: 1 },
      { id: 3, bienTheSanPham: null, soLuongDat: 2, soLuongDaNhan: 0 },
    ],
    new Map([[126, 1]]),
  );
  assert.deepEqual(ds.map((d) => [d.id, d.dangGiu, d.thieu, d.conLai]), [
    [1, 1, 1, 0],
    [2, 0, 2, 2],
    [3, 0, 2, 2],
  ]);
  // Không có phần giữ (tải phiếu nháp lỗi) thì như cách tính cũ
  assert.deepEqual(dongDonKemPhanGiu([{ bienTheSanPham: { id: 1 }, soLuongDat: 4, soLuongDaNhan: 1 }], null)[0].conLai, 3);
  assert.deepEqual(dongDonKemPhanGiu(undefined, new Map()), []);
});

test("donMuaCoPhieuNhap lấy id đơn mua của các phiếu Nháp trong danh sách phiếu nhập", () => {
  const ids = donMuaCoPhieuNhap([
    { id: 1, trangThai: 0, donMuaHangId: 151 },
    { id: 2, trangThai: 0, donMuaHangId: "152" },
    { id: 3, trangThai: 3, donMuaHangId: 153 },
    { id: 4, trangThai: 0, donMuaHangId: null },
    { id: 5, trangThai: 0, donMuaHang: { id: 154 } },
  ]);
  assert.deepEqual([...ids].sort(), [151, 152, 154]);
  assert.equal(donMuaCoPhieuNhap(null).size, 0);
});

test("noiSoPhieu nối số phiếu cho câu thông báo", () => {
  assert.equal(noiSoPhieu([]), "");
  assert.equal(noiSoPhieu([{ soPhieuNhap: "PN1" }]), "PN1");
  assert.equal(noiSoPhieu([{ soPhieuNhap: "PN1" }, { soPhieuNhap: "PN2" }]), "PN1 và PN2");
  assert.equal(noiSoPhieu([{ soPhieuNhap: "PN1" }, { soPhieuNhap: "PN2" }, { soPhieuNhap: "PN3" }]), "PN1, PN2 và PN3");
});
