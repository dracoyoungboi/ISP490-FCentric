// Chạy: node --test src/components/order/chi-tiet-don-mua/tinhNhanHang.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  docSo,
  dungBangDotNhan,
  tinhBuocDonMua,
  tinhTienDoNhan,
  trangThaiGiao,
} from "./tinhNhanHang.js";

const bienThe = (id, mau, size) => ({
  id,
  maSku: `SP018-KKI-${size}-BE`,
  tenSanPham: "Quần kaki slim",
  mauSac: { tenMau: mau },
  size: { tenSize: size },
});

const dongDon = (id, btId, dat, daNhan, size) => ({
  id,
  bienTheSanPham: bienThe(btId, "Be", size),
  soLuongDat: dat,
  soLuongDaNhan: daNhan,
  donGia: 165000,
  thanhTien: dat * 165000,
});

const phieu = (id, trangThai, items, extra = {}) => ({
  id,
  soPhieuNhap: `PNK-${String(id).padStart(4, "0")}`,
  trangThai,
  items,
  ...extra,
});

test("docSo đọc BigDecimal dạng số và chuỗi", () => {
  assert.equal(docSo(80), 80);
  assert.equal(docSo("80.00"), 80);
  assert.equal(docSo(null), 0);
  assert.equal(docSo("abc"), 0);
});

test("tinhTienDoNhan: chưa nhận gì", () => {
  const td = tinhTienDoNhan([dongDon(1, 30, 80, 0, "30"), dongDon(2, 32, 70, 0, "32")]);
  assert.deepEqual(td, { dat: 150, daNhan: 0, conThieu: 150, vuot: 0, phanTram: 0, daDu: false, chuaNhan: true });
});

test("tinhTienDoNhan: nhận một phần, số dạng chuỗi", () => {
  const td = tinhTienDoNhan([dongDon(1, 30, "80.00", "50.00", "30"), dongDon(2, 32, 70, 30, "32")]);
  assert.equal(td.dat, 150);
  assert.equal(td.daNhan, 80);
  assert.equal(td.conThieu, 70);
  assert.equal(td.phanTram, 53);
  assert.equal(td.daDu, false);
  assert.equal(td.chuaNhan, false);
});

test("tinhTienDoNhan: dòng nhận vượt không bù cho dòng còn thiếu", () => {
  const td = tinhTienDoNhan([dongDon(1, 30, 80, 120, "30"), dongDon(2, 32, 70, 30, "32")]);
  assert.equal(td.conThieu, 40);
  assert.equal(td.vuot, 40);
  assert.equal(td.daDu, false);
  assert.equal(td.phanTram, 73); // (80 + 30) / 150
});

test("tinhTienDoNhan: đủ hàng; đơn không có dòng thì không tính là đủ", () => {
  assert.equal(tinhTienDoNhan([dongDon(1, 30, 80, 80, "30")]).daDu, true);
  assert.equal(tinhTienDoNhan([]).daDu, false);
  assert.equal(tinhTienDoNhan(undefined).dat, 0);
});

test("dungBangDotNhan: chưa có phiếu", () => {
  const bang = dungBangDotNhan([dongDon(1, 30, 80, 0, "30")], []);
  assert.equal(bang.cot.length, 0);
  assert.deepEqual(bang.dong[0].theoDot, []);
  assert.equal(bang.dong[0].conThieu, 80);
  assert.equal(bang.dong[0].bienThe, "Be · 30");
  assert.equal(bang.tong.thanhTien, 80 * 165000);
  assert.deepEqual(bang.lechSo, []);
});

test("dungBangDotNhan: phiếu hoàn tất lấy số đã khai báo lô; phiếu chờ nhập đứng sau, không trừ vào còn thiếu", () => {
  const chiTiets = [dongDon(1, 30, 80, 50, "30"), dongDon(2, 32, 70, 30, "32")];
  const phieus = [
    phieu(35, 0, [{ bienTheSanPhamId: 30, soLuongCanNhap: 30, soLuongDaKhaiBao: 10 }], { ngayTao: "2026-10-16T02:00:00Z" }),
    phieu(31, 3, [
      { bienTheSanPhamId: 30, soLuongCanNhap: 50, soLuongDaKhaiBao: 50 },
      { bienTheSanPhamId: 32, soLuongCanNhap: 30, soLuongDaKhaiBao: 30 },
    ], { ngayNhap: "2026-10-14T08:40:00Z", tenNguoiNhap: "Vũ Đức Thắng" }),
  ];
  const bang = dungBangDotNhan(chiTiets, phieus);
  assert.deepEqual(bang.cot.map((c) => [c.soPhieu, c.choNhap]), [["PNK-0031", false], ["PNK-0035", true]]);
  assert.equal(bang.cot[0].nguoiNhap, "Vũ Đức Thắng");
  assert.equal(bang.cot[0].soLuong, undefined, "không lộ Map nội bộ ra ngoài");
  assert.deepEqual(bang.dong[0].theoDot, [50, 30]);
  assert.deepEqual(bang.dong[1].theoDot, [30, null]);
  assert.equal(bang.dong[0].conThieu, 30);
  assert.equal(bang.dong[1].conThieu, 40);
  assert.deepEqual(bang.tong.theoDot, [80, 30]);
  assert.equal(bang.tong.conThieu, 70);
  assert.deepEqual(bang.lechSo, []);
});

test("dungBangDotNhan: bỏ phiếu đã hủy; báo lệch khi tổng các đợt khác số đã nhận của đơn", () => {
  const chiTiets = [dongDon(1, 30, 80, 60, "30")];
  const phieus = [
    phieu(31, 3, [{ bienTheSanPhamId: 30, soLuongCanNhap: 50, soLuongDaKhaiBao: 50 }], { ngayNhap: "2026-10-14T08:40:00Z" }),
    phieu(33, 4, [{ bienTheSanPhamId: 30, soLuongCanNhap: 20, soLuongDaKhaiBao: 0 }]),
  ];
  const bang = dungBangDotNhan(chiTiets, phieus);
  assert.equal(bang.cot.length, 1);
  assert.equal(bang.dong[0].conThieu, 20, "còn thiếu theo số của đơn, không theo tổng các đợt");
  assert.deepEqual(bang.lechSo, [{ bienTheId: 30, maSku: "SP018-KKI-30-BE", theoDot: 50, daNhan: 60 }]);
});

test("dungBangDotNhan: hai đợt hoàn tất xếp theo ngày nhập", () => {
  const chiTiets = [dongDon(1, 30, 80, 80, "30")];
  const phieus = [
    phieu(40, 3, [{ bienTheSanPhamId: 30, soLuongDaKhaiBao: 30 }], { ngayNhap: "2026-10-18T03:00:00Z" }),
    phieu(31, 3, [{ bienTheSanPhamId: 30, soLuongDaKhaiBao: 50 }], { ngayNhap: "2026-10-14T08:40:00Z" }),
  ];
  const bang = dungBangDotNhan(chiTiets, phieus);
  assert.deepEqual(bang.cot.map((c) => c.id), [31, 40]);
  assert.deepEqual(bang.dong[0].theoDot, [50, 30]);
  assert.equal(bang.dong[0].conThieu, 0);
});

test("dungBangDotNhan: hàng lỗi Trừ công nợ / Trả tài xế tính vào đợt đã nhập (khớp số đã nhận của máy chủ), Đổi hàng thì không", () => {
  // Đơn đặt 80 mỗi dòng. Máy chủ: Đổi hàng chỉ cộng đạt; phương án khác cộng đạt + lỗi vào soLuongDaNhan
  const chiTiets = [dongDon(1, 30, 80, 45 + 5 + 18, "30"), dongDon(2, 32, 80, 30, "32")];
  const phieus = [
    phieu(31, 3, [
      { bienTheSanPhamId: 30, soLuongCanNhap: 50, soLuongDaKhaiBao: 45, soLuongLoiQc: 5 },
      { bienTheSanPhamId: 32, soLuongCanNhap: 30, soLuongDaKhaiBao: 30, soLuongLoiQc: 0 },
    ], { ngayNhap: "2026-10-14T08:40:00Z", phuongAnBienBan: "TRU_CONG_NO" }),
    phieu(40, 3, [{ bienTheSanPhamId: 30, soLuongCanNhap: 20, soLuongDaKhaiBao: 18, soLuongLoiQc: 2 }], {
      ngayNhap: "2026-10-18T03:00:00Z",
      phuongAnBienBan: "DOI_HANG",
    }),
    // Phiếu chờ nhập vẫn chỉ hiện số dự kiến, không cộng lỗi
    phieu(45, 0, [{ bienTheSanPhamId: 30, soLuongCanNhap: 10, soLuongDaKhaiBao: 3, soLuongLoiQc: 1 }], { phuongAnBienBan: "TRA_TAI_XE" }),
  ];
  const bang = dungBangDotNhan(chiTiets, phieus);
  assert.deepEqual(bang.dong[0].theoDot, [50, 18, 10]);
  assert.deepEqual(bang.dong[1].theoDot, [30, null, null]);
  assert.deepEqual(bang.lechSo, []);
});

test("dungBangDotNhan: biên bản mã cũ DOI_HANG_MOI và phiếu không có biên bản chỉ tính hàng đạt", () => {
  const chiTiets = [dongDon(1, 30, 80, 45 + 20, "30")];
  const phieus = [
    phieu(31, 3, [{ bienTheSanPhamId: 30, soLuongDaKhaiBao: 45, soLuongLoiQc: 5 }], {
      ngayNhap: "2026-10-14T08:40:00Z",
      phuongAnBienBan: "DOI_HANG_MOI",
    }),
    phieu(40, 3, [{ bienTheSanPhamId: 30, soLuongDaKhaiBao: 20, soLuongLoiQc: 0 }], { ngayNhap: "2026-10-18T03:00:00Z" }),
  ];
  const bang = dungBangDotNhan(chiTiets, phieus);
  assert.deepEqual(bang.dong[0].theoDot, [45, 20]);
  assert.deepEqual(bang.lechSo, []);
});

test("trangThaiGiao: quá hạn, hôm nay, còn lại, đã đủ, không có hạn", () => {
  const homNay = new Date(2026, 9, 16, 9, 0);
  assert.deepEqual(trangThaiGiao(new Date(2026, 9, 15, 0, 0), false, homNay), { loai: "quaHan", soNgay: 1 });
  assert.deepEqual(trangThaiGiao(new Date(2026, 9, 16, 23, 59), false, homNay), { loai: "homNay", soNgay: 0 });
  assert.deepEqual(trangThaiGiao(new Date(2026, 9, 22, 0, 0), false, homNay), { loai: "conLai", soNgay: 6 });
  assert.deepEqual(trangThaiGiao(new Date(2026, 9, 15), true, homNay), { loai: "daDu", soNgay: 0 });
  assert.deepEqual(trangThaiGiao(null, false, homNay), { loai: "khongCo", soNgay: 0 });
});

test("trangThaiGiao: sát nửa đêm vẫn tính theo ngày lịch", () => {
  const homNay = new Date(2026, 9, 16, 0, 5);
  assert.deepEqual(trangThaiGiao(new Date(2026, 9, 15, 23, 55), false, homNay), { loai: "quaHan", soNgay: 1 });
});

const donMau = (extra = {}) => ({
  trangThai: 3,
  ngayDatHang: "2026-10-12T02:15:00Z",
  ngayGiaoDuKien: new Date(2026, 9, 15),
  yeuCauMuaHang: { id: 7, soYeuCauMuaHang: "YC20261010007", ngayTao: "2026-10-10T03:00:00Z" },
  chiTietDonMuaHangs: [dongDon(1, 30, 80, 50, "30"), dongDon(2, 32, 70, 30, "32")],
  ...extra,
});

test("tinhBuocDonMua: đang nhận hàng, quá hạn 1 ngày", () => {
  const buoc = tinhBuocDonMua(donMau(), undefined, [], new Date(2026, 9, 16, 9));
  assert.deepEqual(buoc.map((b) => b.trangThai), ["xong", "xong", "xong", "xong", "dangLam", "chua"]);
  assert.equal(buoc[0].phu, "YC20261010007");
  assert.equal(buoc[0].ngay, "2026-10-10T03:00:00Z");
  assert.equal(buoc[1].ngay, "2026-10-12T02:15:00Z");
  assert.equal(buoc[4].phu, "80/150");
  assert.equal(buoc[4].canhBao, "quá hạn 1 ngày");
  assert.equal(buoc[5].phu, "Còn thiếu 70");
});

test("tinhBuocDonMua: chưa nhận gì và còn hạn thì không cảnh báo", () => {
  const don = donMau({
    ngayGiaoDuKien: new Date(2026, 9, 22),
    chiTietDonMuaHangs: [dongDon(1, 30, 120, 0, "M")],
  });
  const buoc = tinhBuocDonMua(don, undefined, [], new Date(2026, 9, 16));
  assert.equal(buoc[4].phu, "Chưa nhận");
  assert.equal(buoc[4].canhBao, "");
});

test("tinhBuocDonMua: nhận đủ lấy ngày của đợt nhập cuối", () => {
  const don = donMau({ chiTietDonMuaHangs: [dongDon(1, 30, 80, 80, "30")] });
  const cot = [
    { id: 31, choNhap: false, ngay: "2026-10-14T08:40:00Z" },
    { id: 40, choNhap: false, ngay: "2026-10-18T03:00:00Z" },
  ];
  const buoc = tinhBuocDonMua(don, undefined, cot, new Date(2026, 9, 20));
  assert.deepEqual(buoc.map((b) => b.trangThai), ["xong", "xong", "xong", "xong", "xong", "xong"]);
  assert.equal(buoc[4].canhBao, "", "đã đủ thì không báo quá hạn");
  assert.equal(buoc[5].ngay, "2026-10-18T03:00:00Z");
});

test("tinhBuocDonMua: đơn cũ trạng thái 5 coi như đã chốt", () => {
  const buoc = tinhBuocDonMua(donMau({ trangThai: 5 }), undefined, [], new Date(2026, 9, 16));
  assert.equal(buoc[3].trangThai, "xong");
  assert.equal(buoc[4].trangThai, "dangLam");
});

test("tinhBuocDonMua: đơn chưa chốt hoặc bị từ chối", () => {
  const daGui = tinhBuocDonMua(donMau({ trangThai: 1 }), undefined, [], new Date(2026, 9, 16));
  assert.deepEqual(daGui.map((b) => b.trangThai), ["xong", "xong", "dangLam", "chua", "chua", "chua"]);
  const daBaoGia = tinhBuocDonMua(donMau({ trangThai: 2 }), undefined, [], new Date(2026, 9, 16));
  assert.deepEqual(daBaoGia.map((b) => b.trangThai), ["xong", "xong", "xong", "dangLam", "chua", "chua"]);
  const tuChoi = tinhBuocDonMua(donMau({ trangThai: 4 }), undefined, [], new Date(2026, 9, 16));
  assert.equal(tuChoi[3].trangThai, "dung");
  assert.equal(tuChoi[3].phu, "Không chấp nhận báo giá");
  assert.equal(tuChoi[5].phu, "");
});

test("tinhBuocDonMua: thiếu yêu cầu gốc vẫn chạy (backend cũ chưa trả trường này)", () => {
  const buoc = tinhBuocDonMua(donMau({ yeuCauMuaHang: undefined }), undefined, [], new Date(2026, 9, 16));
  assert.equal(buoc[0].phu, "");
  assert.equal(buoc[0].ngay, null);
});
