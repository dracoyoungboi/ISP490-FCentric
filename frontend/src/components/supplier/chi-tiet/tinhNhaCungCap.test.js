import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demViecDangDo,
  dungHoatDong,
  giaoHangTheoDon,
  ngayNhapCuoiTheoDon,
  phanLoaiDon,
  tinhChiSo,
  tinhGiaoHang,
  tinhLichSuGia,
  timViecDangMo,
} from "./tinhNhaCungCap.js";

// Ngày theo giờ máy (giống cách màn hình đọc), 10:00 cho chắc chắn không lệch ngày.
const ngay = (s, gio = "10:00") => new Date(`${s}T${gio}:00`).toISOString();
const HOM_NAY = new Date("2026-10-16T09:00:00");

const bt = (id, gia = 0) => ({
  id,
  tenSanPham: `Sản phẩm ${id}`,
  maSku: `SKU-${id}`,
  mauSac: { tenMau: "Be" },
  size: { tenSize: "30" },
  giaVon: gia,
});
const ct = (bienThe, dat, nhan, gia) => ({ bienTheSanPham: bienThe, soLuongDat: String(dat), soLuongDaNhan: String(nhan), donGia: String(gia) });
const don = (id, trangThai, { dat = "2026-10-01", han = null, chiTiet = [], tong = 0 } = {}) => ({
  id,
  soDonMua: `PO${id}`,
  trangThai,
  ngayDatHang: ngay(dat),
  ngayTao: ngay(dat),
  ngayGiaoDuKien: han ? ngay(han, "00:00") : null,
  tongTien: String(tong),
  chiTietDonMuaHangs: chiTiet,
  nguoiTao: { hoTen: "Lê Minh Anh" },
});
const phieu = (id, donId, trangThai, ngayNhap) => ({
  id,
  soPhieuNhap: `PNK-${id}`,
  donMuaHangId: donId,
  soDonMua: `PO${donId}`,
  trangThai,
  ngayNhap: ngayNhap ? ngay(ngayNhap) : null,
  tenKho: "Kho tổng",
});

test("phanLoaiDon: tách đã chốt (3, 5) và báo giá (1, 2, 4), mới nhất trước; bỏ trạng thái lạ", () => {
  const ds = [don(1, 3, { dat: "2026-09-01" }), don(2, 5, { dat: "2026-10-01" }), don(3, 2), don(4, 4), don(5, 1), don(6, 0)];
  const { chot, baoGia } = phanLoaiDon(ds);
  assert.deepEqual(chot.map((d) => d.id), [2, 1]);
  assert.deepEqual(baoGia.map((d) => d.id).sort(), [3, 4, 5]);
  assert.deepEqual(phanLoaiDon(null), { chot: [], baoGia: [] });
});

test("ngayNhapCuoiTheoDon: chỉ phiếu đã nhập (3), lấy ngày muộn nhất; null khi không có danh sách", () => {
  const map = ngayNhapCuoiTheoDon([
    phieu(1, 10, 3, "2026-10-05"),
    phieu(2, 10, 3, "2026-10-08"),
    phieu(3, 10, 0, "2026-10-20"), // phiếu nháp không tính
    phieu(4, 11, 3, null),
  ]);
  assert.equal(map.get(10).toISOString(), ngay("2026-10-08"));
  assert.equal(map.has(11), false);
  assert.equal(ngayNhapCuoiTheoDon(null), null);
});

test("tinhGiaoHang: chưa đủ thì theo hạn; đủ thì đúng hạn / trễ theo phiếu cuối; không biết ngày nhập thì daDu", () => {
  const sp = bt(1);
  const chuaDu = don(1, 3, { han: "2026-10-15", chiTiet: [ct(sp, 10, 4, 1)] });
  assert.equal(tinhGiaoHang(chuaDu, new Map(), HOM_NAY).loai, "quaHan");
  assert.equal(tinhGiaoHang(chuaDu, new Map(), HOM_NAY).soNgay, 1);
  const conHan = don(2, 3, { han: "2026-10-22", chiTiet: [ct(sp, 10, 0, 1)] });
  assert.deepEqual([tinhGiaoHang(conHan, null, HOM_NAY).loai, tinhGiaoHang(conHan, null, HOM_NAY).soNgay], ["conLai", 6]);

  const du = don(3, 3, { han: "2026-10-10", chiTiet: [ct(sp, 10, 10, 1)] });
  assert.equal(tinhGiaoHang(du, new Map([[3, new Date(ngay("2026-10-10"))]]), HOM_NAY).loai, "dungHan");
  const tre = tinhGiaoHang(du, new Map([[3, new Date(ngay("2026-10-12"))]]), HOM_NAY);
  assert.deepEqual([tre.loai, tre.soNgay], ["tre", 2]);
  assert.equal(tinhGiaoHang(du, null, HOM_NAY).loai, "daDu");
  const duKhongHan = don(4, 3, { chiTiet: [ct(sp, 5, 5, 1)] });
  assert.equal(tinhGiaoHang(duKhongHan, new Map([[4, new Date()]]), HOM_NAY).loai, "daDu");
});

test("tinhChiSo: giá trị, giao đúng hạn (chỉ đơn đã đủ và biết ngày), tỉ lệ chốt bỏ báo giá đang chờ", () => {
  const sp = bt(1);
  const dons = [
    don(1, 3, { dat: "2026-09-22", han: "2026-09-25", chiTiet: [ct(sp, 150, 150, 1)], tong: "29150000" }),
    don(2, 3, { dat: "2026-09-29", han: "2026-09-30", chiTiet: [ct(sp, 60, 60, 1)], tong: "9900000" }),
    don(3, 5, { dat: "2026-10-04", han: "2026-10-07", chiTiet: [ct(sp, 90, 90, 1)], tong: "14850000" }),
    don(4, 3, { dat: "2026-10-08", han: "2026-10-11", chiTiet: [ct(sp, 200, 200, 1)], tong: "31200000" }),
    don(5, 3, { dat: "2026-10-12", han: "2026-10-15", chiTiet: [ct(sp, 150, 80, 1)], tong: "24750000" }),
    don(6, 3, { dat: "2026-10-15", han: "2026-10-22", chiTiet: [ct(sp, 120, 0, 1)], tong: "18600000" }),
    don(7, 4), don(8, 4), don(9, 2), don(10, 1),
  ];
  const phieus = [
    phieu(12, 1, 3, "2026-09-24"),
    phieu(18, 2, 3, "2026-10-01"), // trễ 1 ngày
    phieu(22, 3, 3, "2026-10-06"),
    phieu(27, 4, 3, "2026-10-10"),
    phieu(31, 5, 3, "2026-10-14"),
  ];
  const { chot, baoGia } = phanLoaiDon(dons);
  const giao = giaoHangTheoDon(chot, phieus, HOM_NAY);
  const cs = tinhChiSo(chot, baoGia, giao);
  assert.equal(cs.giaTri.tong, 128450000);
  assert.equal(cs.giaTri.soDon, 6);
  assert.deepEqual([cs.giaoDungHan.dungHan, cs.giaoDungHan.daXet, cs.giaoDungHan.phanTram], [3, 4, 75]);
  assert.deepEqual(cs.giaoDungHan.vach.map((v) => v.loai), ["dungHan", "tre", "dungHan", "dungHan", "quaHan", "conLai"]);
  assert.deepEqual([cs.tiLeChot.daChot, cs.tiLeChot.daXet, cs.tiLeChot.phanTram], [6, 8, 75]);
  assert.equal(cs.lanDatGanNhat.don.id, 6);

  // Vai trò không xem phiếu nhập: không tính được giao đúng hạn, không vẽ vạch
  const khongPhieu = tinhChiSo(chot, baoGia, giaoHangTheoDon(chot, null, HOM_NAY), { coNgayNhap: false });
  assert.equal(khongPhieu.giaoDungHan.tinhDuoc, false);
  assert.equal(khongPhieu.giaoDungHan.phanTram, null);
  assert.deepEqual(khongPhieu.giaoDungHan.vach, []);
});

test("tinhChiSo: nhà cung cấp chưa có giao dịch thì không chia cho 0", () => {
  const cs = tinhChiSo([], [], new Map());
  assert.equal(cs.giaTri.tong, 0);
  assert.equal(cs.giaoDungHan.phanTram, null);
  assert.equal(cs.tiLeChot.phanTram, null);
  assert.equal(cs.lanDatGanNhat, null);
});

test("timViecDangMo: quá hạn lâu nhất trước, rồi hôm nay, còn ít ngày, cuối cùng báo giá chờ duyệt", () => {
  const sp = bt(1);
  const dons = [
    don(1, 3, { dat: "2026-10-01", han: "2026-10-22", chiTiet: [ct(sp, 10, 0, 1)] }),
    don(2, 3, { dat: "2026-10-02", han: "2026-10-14", chiTiet: [ct(sp, 10, 2, 1)] }),
    don(3, 3, { dat: "2026-10-03", han: "2026-10-16", chiTiet: [ct(sp, 10, 0, 1)] }),
    don(4, 3, { dat: "2026-10-04", han: "2026-10-15", chiTiet: [ct(sp, 10, 0, 1)] }),
    don(5, 3, { dat: "2026-10-05", han: "2026-10-18", chiTiet: [ct(sp, 10, 0, 1)] }),
    don(6, 3, { dat: "2026-10-06", han: "2026-10-10", chiTiet: [ct(sp, 10, 10, 1)] }), // đã đủ: không mở
    don(7, 2, { dat: "2026-10-07" }),
    don(8, 1, { dat: "2026-10-08" }), // chờ nhà cung cấp: không phải việc của mình
  ];
  const { chot, baoGia } = phanLoaiDon(dons);
  const viec = timViecDangMo(chot, baoGia, giaoHangTheoDon(chot, [], HOM_NAY));
  assert.deepEqual(viec.map((v) => v.don.id), [2, 4, 3, 5, 1, 7]);
  assert.deepEqual(demViecDangDo(viec), { donChoGiao: 5, baoGiaChoDuyet: 1 });
});

test("tinhLichSuGia: giá gần nhất, thấp – cao, so với lần trước, số đã đặt; chỉ đơn đã chốt", () => {
  const a = bt(1);
  const b = bt(2);
  const dons = [
    don(1, 3, { dat: "2026-09-01", chiTiet: [ct(a, 100, 100, 150000), ct(b, 20, 20, 120000)] }),
    don(2, 3, { dat: "2026-10-01", chiTiet: [ct(a, 130, 0, 155000)] }),
    don(3, 5, { dat: "2026-10-05", chiTiet: [ct(b, 10, 0, 120000)] }),
    don(4, 2, { dat: "2026-10-10", chiTiet: [ct(a, 10, 0, 999000)] }), // báo giá chưa chốt: không tính
  ];
  const { chot } = phanLoaiDon(dons);
  const ls = tinhLichSuGia(chot);
  assert.deepEqual(ls.map((r) => r.bienTheId), [2, 1]);
  const ra = ls.find((r) => r.bienTheId === 1);
  assert.equal(ra.giaGanNhat, 155000);
  assert.deepEqual([ra.giaThap, ra.giaCao], [150000, 155000]);
  assert.deepEqual(ra.soVoiTruoc, { loai: "tang", phanTram: 3.3 });
  assert.equal(ra.daDat, 230);
  assert.equal(ra.moTa, "Be · 30");
  const rb = ls.find((r) => r.bienTheId === 2);
  assert.deepEqual(rb.soVoiTruoc, { loai: "khongDoi", phanTram: 0 });

  const motLan = tinhLichSuGia(phanLoaiDon([don(9, 3, { chiTiet: [ct(a, 5, 0, 10)] })]).chot);
  assert.deepEqual(motLan[0].soVoiTruoc, { loai: "lanDau", phanTram: null });
  const giam = tinhLichSuGia(phanLoaiDon([
    don(10, 3, { dat: "2026-09-01", chiTiet: [ct(a, 1, 0, 125000)] }),
    don(11, 3, { dat: "2026-10-01", chiTiet: [ct(a, 1, 0, 120000)] }),
  ]).chot);
  assert.deepEqual(giam[0].soVoiTruoc, { loai: "giam", phanTram: 4 });
});

test("dungHoatDong: gửi yêu cầu báo giá, nhập kho (phiếu đã nhập), tạo nhà cung cấp; mới nhất trước", () => {
  const ncc = { maNhaCungCap: "SUP002", ngayTao: ngay("2026-09-15", "09:20") };
  const dons = [don(1, 3, { dat: "2026-10-12" }), don(2, 1, { dat: "2026-10-16" })];
  const phieus = [phieu(31, 1, 3, "2026-10-14"), phieu(35, 1, 0, null)];
  const sk = dungHoatDong({ ncc, dons, phieus });
  assert.deepEqual(sk.map((s) => s.khoa), ["don-2", "phieu-31", "don-1", "tao-ncc"]);
  assert.equal(sk[1].soDonMua, "PO1");
  // Không xem được phiếu nhập: chỉ còn sự kiện của đơn và nhà cung cấp
  assert.deepEqual(dungHoatDong({ ncc, dons, phieus: null }).map((s) => s.loai), ["guiYeuCau", "guiYeuCau", "taoNcc"]);
  assert.deepEqual(dungHoatDong({ ncc: {}, dons: [], phieus: [] }), []);
});
