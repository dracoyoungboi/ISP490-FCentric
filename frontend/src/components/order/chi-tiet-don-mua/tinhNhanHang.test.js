// Chạy: node --test src/components/order/chi-tiet-don-mua/tinhNhanHang.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bienBanConCho,
  conThieuDong,
  docSo,
  dungBangDotNhan,
  hangLoiChuyenKhiDongDon,
  nhanBuTheoBienThe,
  thaoTacKetThuc,
  tomTatPhuongAn,
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
  assert.deepEqual(td, { dat: 150, daNhan: 0, truTien: 0, conThieu: 150, vuot: 0, phanTram: 0, daDu: false, chuaNhan: true });
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

test("dungBangDotNhan: phiếu đã nhập có hàng lỗi hiện số đạt, số lỗi để riêng; phiếu chờ nhập giữ số dự kiến", () => {
  // Máy chủ chỉ cộng hàng đạt vào soLuongDaNhan: 45 + 18
  const chiTiets = [dongDon(1, 30, 80, 45 + 18, "30"), dongDon(2, 32, 80, 30, "32")];
  const phieus = [
    phieu(31, 3, [
      { bienTheSanPhamId: 30, soLuongCanNhap: 50, soLuongDaKhaiBao: 45, soLuongLoiQc: 5 },
      { bienTheSanPhamId: 32, soLuongCanNhap: 30, soLuongDaKhaiBao: 30, soLuongLoiQc: 0 },
    ], { ngayNhap: "2026-10-14T08:40:00Z" }),
    phieu(40, 3, [{ bienTheSanPhamId: 30, soLuongCanNhap: 20, soLuongDaKhaiBao: 18, soLuongLoiQc: 2 }], {
      ngayNhap: "2026-10-18T03:00:00Z",
    }),
    // Phiếu chờ nhập vẫn chỉ hiện số dự kiến, không có số lỗi
    phieu(45, 0, [{ bienTheSanPhamId: 30, soLuongCanNhap: 10, soLuongDaKhaiBao: 3, soLuongLoiQc: 1 }]),
  ];
  const bang = dungBangDotNhan(chiTiets, phieus);
  assert.deepEqual(bang.dong[0].theoDot, [45, 18, 10]);
  assert.deepEqual(bang.dong[0].theoDotLoi, [5, 2, 0]);
  assert.deepEqual(bang.dong[1].theoDot, [30, null, null]);
  assert.deepEqual(bang.dong[1].theoDotLoi, [0, 0, 0]);
  assert.deepEqual(bang.tong.theoDotLoi, [5, 2, 0]);
  // Hàng lỗi chưa chốt vẫn là còn thiếu
  assert.equal(bang.dong[0].conThieu, 80 - 63);
  assert.deepEqual(bang.lechSo, []);
});

test("conThieuDong / tinhTienDoNhan: hàng lỗi đã chốt trừ tiền làm dòng đủ", () => {
  const dong = { ...dongDon(1, 30, 80, 80, "30"), soLuongTruTien: "5.000" };
  assert.equal(conThieuDong(dong), 0);
  const td = tinhTienDoNhan([dong, dongDon(2, 32, 70, 70, "32")]);
  assert.equal(td.truTien, 5);
  assert.equal(td.conThieu, 0);
  assert.equal(td.daDu, true);
  assert.equal(td.phanTram, 100);
  assert.equal(td.chuaNhan, false);
});

test("tinhTienDoNhan: trừ tiền một phần, tiến độ tính cả trừ tiền", () => {
  const td = tinhTienDoNhan([{ ...dongDon(1, 30, 100, 50, "30"), soLuongTruTien: 10 }]);
  assert.equal(td.conThieu, 50);
  assert.equal(td.phanTram, 50);
  assert.equal(td.daDu, false);
});

test("dungBangDotNhan: thành tiền theo số đã giảm trừ, tổng có giảm trừ và giá trị hàng đạt đã nhận", () => {
  const chiTiets = [
    { ...dongDon(1, 30, 80, 80, "30"), soLuongTruTien: 5 },
    dongDon(2, 32, 70, 30, "32"),
  ];
  const bang = dungBangDotNhan(chiTiets, []);
  const [d0, d1] = bang.dong;
  assert.equal(d0.truTien, 5);
  assert.equal(d0.conThieu, 0);
  assert.equal(d0.thanhTien, 75 * 165000);
  assert.equal(d0.giamTru, 5 * 165000);
  assert.equal(d1.thanhTien, 70 * 165000);
  assert.equal(bang.tong.truTien, 5);
  assert.equal(bang.tong.thanhTienTheoDat, 150 * 165000);
  assert.equal(bang.tong.giamTru, 5 * 165000);
  assert.equal(bang.tong.thanhTien, 145 * 165000);
  assert.equal(bang.tong.giaTriDaNhan, (75 + 30) * 165000);
});

test("thaoTacKetThuc: theo số phiếu nhập hoàn tất", () => {
  const don = donMau();
  // Có phiếu hoàn tất, còn thiếu: đóng
  assert.deepEqual(thaoTacKetThuc(don, undefined, true, 1), { dong: true, huy: false });
  // Chưa có phiếu hoàn tất: hủy
  assert.deepEqual(thaoTacKetThuc(donMau({ chiTietDonMuaHangs: [dongDon(1, 30, 80, 0, "30")] }), undefined, true, 0), { dong: false, huy: true });
  // Không có quyền / không đang vận chuyển
  assert.deepEqual(thaoTacKetThuc(don, undefined, false, 1), { dong: false, huy: false });
  assert.deepEqual(thaoTacKetThuc(donMau({ trangThai: 6 }), undefined, true, 1), { dong: false, huy: false });
  // Đủ hàng (kể cả nhờ trừ tiền): không đóng, không hủy
  const du = donMau({ chiTietDonMuaHangs: [{ ...dongDon(1, 30, 80, 80, "30"), soLuongTruTien: 10 }] });
  assert.deepEqual(thaoTacKetThuc(du, undefined, true, 1), { dong: false, huy: false });
  // Chưa biết số phiếu: đoán theo số đã nhận
  assert.deepEqual(thaoTacKetThuc(don, undefined, true, null), { dong: true, huy: false });
});

test("thaoTacKetThuc: đơn có đợt đầu toàn hàng lỗi thì đóng được, không hủy được", () => {
  // Phiếu 31 hoàn tất, 20 sản phẩm đều lỗi: đã nhận 0, còn thiếu 80
  const don = donMau({ chiTietDonMuaHangs: [dongDon(1, 30, 80, 0, "30")] });
  const bang = dungBangDotNhan(don.chiTietDonMuaHangs, [
    phieu(31, 3, [{ bienTheSanPhamId: 30, soLuongCanNhap: 20, soLuongDaKhaiBao: 0, soLuongLoiQc: 20 }], { ngayNhap: "2026-10-14T08:40:00Z" }),
  ]);
  assert.deepEqual(bang.dong[0].theoDot, [0]);
  assert.deepEqual(bang.dong[0].theoDotLoi, [20]);
  const soPhieuHoanTat = bang.cot.filter((c) => !c.choNhap).length;
  assert.deepEqual(thaoTacKetThuc(don, undefined, true, soPhieuHoanTat), { dong: true, huy: false });
  // Bước Nhận hàng không còn ghi "Chưa nhận"
  const buoc = tinhBuocDonMua(don, undefined, bang.cot, new Date(2026, 9, 14));
  assert.equal(buoc[4].phu, "0/80");
});

test("tinhBuocDonMua: có trừ tiền thì bước Nhận hàng ghi kèm số trừ tiền", () => {
  const don = donMau({ chiTietDonMuaHangs: [{ ...dongDon(1, 30, 80, 80, "30"), soLuongTruTien: 5 }] });
  const buoc = tinhBuocDonMua(don, undefined, [{ id: 31, choNhap: false, ngay: "2026-10-14T08:40:00Z" }], new Date(2026, 9, 20));
  assert.equal(buoc[4].trangThai, "xong");
  assert.equal(buoc[4].phu, "75 đạt + 5 trừ tiền / 80");
  assert.equal(buoc[5].trangThai, "xong");
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

test("tinhBuocDonMua: bước Gửi yêu cầu báo giá lấy lúc email gửi được (ngayGuiYeuCau), trống thì ngày tạo đơn", () => {
  const coNgayGui = tinhBuocDonMua(donMau({ ngayGuiYeuCau: "2026-10-12T02:16:30Z" }), undefined, [], new Date(2026, 9, 16));
  assert.equal(coNgayGui[1].ngay, "2026-10-12T02:16:30Z");
  const trong = tinhBuocDonMua(donMau({ ngayGuiYeuCau: null }), undefined, [], new Date(2026, 9, 16));
  assert.equal(trong[1].ngay, "2026-10-12T02:15:00Z");
});

test("tinhBuocDonMua: thiếu yêu cầu gốc vẫn chạy (backend cũ chưa trả trường này)", () => {
  const buoc = tinhBuocDonMua(donMau({ yeuCauMuaHang: undefined }), undefined, [], new Date(2026, 9, 16));
  assert.equal(buoc[0].phu, "");
  assert.equal(buoc[0].ngay, null);
});

test("dungBangDotNhan: dòng có màu, mã màu, kích cỡ để vẽ chấm màu", () => {
  const ct = { id: 1, bienTheSanPham: { ...bienThe(30, "Be", "30"), mauSac: { tenMau: "Be", maMauHex: "#e8d8b8" } }, soLuongDat: 2, soLuongDaNhan: 0 };
  const [d] = dungBangDotNhan([ct], []).dong;
  assert.equal(d.tenMau, "Be");
  assert.equal(d.maMauHex, "#e8d8b8");
  assert.equal(d.kichCo, "30");
  const [khong] = dungBangDotNhan([dongDon(2, 31, 1, 0, "32")], []).dong;
  assert.equal(khong.maMauHex, "");
});

const bienBan = (id, phuongAn, theoBienThe, extra = {}) => ({
  id,
  soBienBan: `BBTH-${id}`,
  trangThai: "CHO_TRA_HANG",
  phieuDaNhap: true,
  phuongAn,
  theoBienThe,
  ...extra,
});

test("nhanBuTheoBienThe: chờ chốt, chờ hàng bù; bỏ biên bản đã hủy, chưa nhập kho, giao bù đã đủ, trừ tiền", () => {
  const ds = [
    bienBan(1, "CHO_CHOT", [{ bienTheSanPhamId: 30, soLuongLoi: 5 }]),
    bienBan(2, "DOI_HANG", [{ bienTheSanPhamId: 30, soLuongLoi: 2 }, { bienTheSanPhamId: 32, soLuongLoi: 3 }]),
    bienBan(3, "DOI_HANG", [{ bienTheSanPhamId: 34, soLuongLoi: 1 }], { buXong: true }),
    bienBan(4, "TRU_CONG_NO", [{ bienTheSanPhamId: 36, soLuongLoi: 1 }]),
    bienBan(5, "CHO_CHOT", [{ bienTheSanPhamId: 38, soLuongLoi: 1 }], { trangThai: "DA_HUY" }),
    bienBan(6, "CHO_CHOT", [{ bienTheSanPhamId: 40, soLuongLoi: 1 }], { phieuDaNhap: false }),
  ];
  assert.deepEqual(nhanBuTheoBienThe(ds), { 30: "choChot", 32: "choHangBu" });
  assert.deepEqual(nhanBuTheoBienThe(undefined), {});
});

test("hangLoiChuyenKhiDongDon: tối đa phần còn thiếu dòng đơn, trừ dần qua các biên bản", () => {
  const chiTiets = [dongDon(1, 30, 80, 72, "30"), dongDon(2, 32, 70, 70, "32")]; // còn thiếu 8 và 0
  const ds = [
    bienBan(1, "CHO_CHOT", [{ bienTheSanPhamId: 30, soLuongLoi: 5 }]),
    bienBan(2, "DOI_HANG", [{ bienTheSanPhamId: 30, soLuongLoi: 5 }, { bienTheSanPhamId: 32, soLuongLoi: 2 }]),
    bienBan(3, "TRU_CONG_NO", [{ bienTheSanPhamId: 30, soLuongLoi: 4 }]),
  ];
  assert.deepEqual(hangLoiChuyenKhiDongDon(ds, chiTiets), { soLuong: 8, soBienBan: ["BBTH-1", "BBTH-2"] });
  // Không có dòng đơn: dùng còn thiếu biên bản trả về
  const khongDong = [bienBan(7, "CHO_CHOT", [{ bienTheSanPhamId: 50, soLuongLoi: 6, conThieuDongDon: "4.000" }])];
  assert.deepEqual(hangLoiChuyenKhiDongDon(khongDong, []), { soLuong: 4, soBienBan: ["BBTH-7"] });
  assert.deepEqual(hangLoiChuyenKhiDongDon([], chiTiets), { soLuong: 0, soBienBan: [] });
});

test("tomTatPhuongAn: chưa chốt, trừ tiền, giao bù", () => {
  const tien = (n) => `${n} đ`;
  assert.equal(tomTatPhuongAn(bienBan(1, "CHO_CHOT", []), tien), "chờ nhà cung cấp chọn");
  assert.equal(tomTatPhuongAn(bienBan(1, "TRU_CONG_NO", [], { tienTruTien: "825000.00" }), tien), "trừ tiền 825000 đ");
  assert.equal(tomTatPhuongAn(bienBan(1, "DOI_HANG", []), tien), "giao bù");
  assert.equal(tomTatPhuongAn(bienBan(1, "DOI_HANG", [], { buXong: true }), tien), "giao bù, đã đủ");
  assert.equal(tomTatPhuongAn(bienBan(1, "CHO_CHOT", [], { phieuDaNhap: false }), tien), "");
});

test("biên bản dòng trừ tiền dòng giao bù (HON_HOP): chỉ phần giao bù / chờ chọn còn chờ", () => {
  const hon = {
    id: 9, soBienBan: "RTV-9", phieuDaNhap: true, phuongAn: "HON_HOP", buXong: false, tienTruTien: 30000,
    theoBienThe: [
      { bienTheSanPhamId: 1, soLuongLoi: 2, soLuongGiaoBu: 0, soLuongChoChon: 0, conThieuDongDon: 0 },
      { bienTheSanPhamId: 2, soLuongLoi: 1, soLuongGiaoBu: 1, soLuongChoChon: 0, conThieuDongDon: 1 },
    ],
  };
  assert.equal(bienBanConCho(hon), true);
  assert.deepEqual(nhanBuTheoBienThe([hon]), { 2: "choHangBu" }, "biến thể toàn dòng trừ tiền không còn chờ");
  assert.deepEqual(hangLoiChuyenKhiDongDon([hon], []), { soLuong: 1, soBienBan: ["RTV-9"] });
  assert.equal(tomTatPhuongAn(hon, (n) => `${n} đ`), "trừ tiền 30000 đ, giao bù");
  assert.equal(bienBanConCho({ ...hon, buXong: true }), false);
});
