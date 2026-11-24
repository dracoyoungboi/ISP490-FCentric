// Chạy: node --test src/components/supplier-portal/congUtils.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { NHAN_HANG_LOI, NHAN_KET_QUA_BAO_GIA, NHAN_TRANG_THAI_BIEN_BAN } from "../../constants/congNhaCungCap.js";
import {
  PHUONG_AN,
  HANG_LOI,
  cachXuLyLichSu,
  choTraLoi,
  coTheChon,
  chuanHoaKhoang,
  demViec,
  loiNguoiXacNhan,
  nhanHangLoi,
  nhanTrangThaiBienBan,
  thuocTinhDong,
  tiLePhanTram,
  tienTruDaChot,
  tuNgayTheoKhoang,
  apDungNhanh,
  canChon,
  chuKyLuaChon,
  coDongDoi,
  dongConThieu,
  giaTriChung,
  khoiTaoLuaChon,
  luaChonHieuLuc,
  soDongMo,
  soSanPhamConThieu,
  soTieuHuyMoi,
  taoPayloadTheoDong,
  tomTatLuaChon,
  trangThaiTheDong,
  truTienDong,
} from "./congUtils.js";
import { bieuTuongCuaNhan, nhomCuaNhan } from "../../constants/trangThai.js";

test("mọi nhãn của cổng có nhóm màu và biểu tượng trong constants/trangThai.js", () => {
  const nhan = [
    ...Object.values(NHAN_KET_QUA_BAO_GIA),
    ...Object.values(NHAN_HANG_LOI),
    ...Object.values(NHAN_TRANG_THAI_BIEN_BAN),
  ];
  for (const n of nhan) {
    assert.ok(nhomCuaNhan(n), `${n} chưa có nhóm`);
    assert.ok(bieuTuongCuaNhan(n), `${n} chưa có biểu tượng`);
  }
  assert.equal(nhomCuaNhan(NHAN_KET_QUA_BAO_GIA.DUOC_CHAP_NHAN), "xong");
  assert.equal(nhomCuaNhan(NHAN_KET_QUA_BAO_GIA.KHONG_CHAP_NHAN), "dong");
  assert.equal(nhomCuaNhan(NHAN_KET_QUA_BAO_GIA.CHO_KET_QUA), "dang");
  assert.equal(nhomCuaNhan(NHAN_TRANG_THAI_BIEN_BAN.CHO_XAC_NHAN), "canChuY");
  assert.equal(nhomCuaNhan(NHAN_HANG_LOI.CHO_CHON), "canChuY");
  assert.equal(nhomCuaNhan(NHAN_HANG_LOI.NHAN_LAI), "canChuY");
});

test("tuNgayTheoKhoang: theo ngày Việt Nam, lùi tháng kẹp cuối tháng", () => {
  // 23/11/2026 08:00 giờ VN (01:00 UTC)
  const luc = new Date("2026-11-23T01:00:00Z");
  assert.equal(tuNgayTheoKhoang("1", luc), "2026-10-24");
  assert.equal(tuNgayTheoKhoang("6", luc), "2026-05-23");
  assert.equal(tuNgayTheoKhoang("12", luc), "2025-11-23");
  // 31/08 lùi 6 tháng → 28/02
  assert.equal(tuNgayTheoKhoang("6", new Date("2026-08-31T05:00:00Z")), "2026-02-28");
  // 23:30 ngày 31/12 giờ UTC đã là 01/01 giờ VN
  assert.equal(tuNgayTheoKhoang("12", new Date("2026-12-31T18:30:00Z")), "2026-01-01");
  // Khoảng lạ → mặc định 6 tháng
  assert.equal(chuanHoaKhoang("99"), "6");
  assert.equal(tuNgayTheoKhoang("x", luc), "2026-05-23");
});

test("demViec, tiLePhanTram", () => {
  assert.equal(demViec({ bienBanCho: [1, 2], donChoBaoGia: [1] }), 3);
  assert.equal(demViec(null), 0);
  assert.equal(tiLePhanTram(4, 6), "67%");
  assert.equal(tiLePhanTram(0, 0), null);
  assert.equal(tiLePhanTram(1, null), null);
});

test("cachXuLyLichSu", () => {
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "CHO_CHOT" }), { loai: "cho" });
  assert.deepEqual(cachXuLyLichSu({ phuongAn: null }), { loai: "cho" });
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "TRU_CONG_NO", tienTru: 60000 }), { loai: "tru", tien: 60000 });
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "TRU_CONG_NO", tienTru: 0 }), { loai: "tru", tien: null }, "không hiện −0 ₫");
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "TRU_CONG_NO", tienTru: null }), { loai: "tru", tien: null });
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "DOI_HANG", buXong: false, conChoGiao: 4 }), { loai: "bu", xong: false, conLai: 4 });
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "DOI_HANG", buXong: false, conChoGiao: 0 }), { loai: "bu", xong: false, conLai: 0 }, "chưa nhận đủ thì không nói đã giao đủ");
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "DOI_HANG", buXong: true, conChoGiao: 0 }), { loai: "bu", xong: true, conLai: 0 });
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "CHO_CHOT", daHuy: true }), { loai: "huy" });
});

test("choTraLoi / coTheChon / nhanTrangThaiBienBan / nhanHangLoi / tienTruDaChot", () => {
  assert.equal(choTraLoi({ trangThai: "CHO_XAC_NHAN" }), true);
  assert.equal(choTraLoi({ trangThai: "DA_XAC_NHAN" }), false);
  assert.equal(coTheChon({ trangThai: "CHO_XAC_NHAN", cachBuMo: ["DOI_HANG", "TRU_CONG_NO"], hangLoiMo: [] }), true);
  assert.equal(coTheChon({ trangThai: "DA_XAC_NHAN", cachBuMo: [], hangLoiMo: ["NHAN_LAI", "TIEU_HUY"] }), true, "hàng lỗi còn đổi được");
  assert.equal(coTheChon({ trangThai: "DA_XAC_NHAN", cachBuMo: [], hangLoiMo: [] }), false);
  assert.equal(coTheChon({ trangThai: "DA_HUY", cachBuMo: ["DOI_HANG"] }), false);
  assert.equal(nhanTrangThaiBienBan({ trangThai: "DA_HUY" }), "Đã hủy");
  assert.equal(nhanTrangThaiBienBan({ trangThai: "DA_XAC_NHAN" }), "Đã xác nhận");
  assert.equal(nhanTrangThaiBienBan({ trangThai: "CHO_XAC_NHAN", cachBuMo: ["DOI_HANG"] }), "Chờ bạn xác nhận");
  assert.equal(nhanTrangThaiBienBan({ trangThai: "CHO_XAC_NHAN", cachBuMo: [], hangLoiMo: [] }), "Hết hạn");
  assert.equal(nhanHangLoi({ hangLoi: "O_KHO", hangLoiNcc: null }), "Chờ bạn chọn");
  assert.equal(nhanHangLoi({ hangLoi: "O_KHO", hangLoiNcc: HANG_LOI.NHAN_LAI }), "Ở kho chờ lấy");
  assert.equal(nhanHangLoi({ hangLoi: "O_KHO", hangLoiNcc: HANG_LOI.TIEU_HUY }), "Chờ tiêu hủy");
  assert.equal(nhanHangLoi({ hangLoi: "DA_TRA", hangLoiNcc: HANG_LOI.NHAN_LAI }), "Đã trả");
  assert.equal(nhanHangLoi({ hangLoi: "O_KHO", daHuy: true }), null);
  assert.equal(nhanHangLoi({ hangLoi: "O_KHO", hangLoiNcc: "HON_HOP" }), "Ở kho chờ xử lý");
  assert.equal(nhanHangLoi({ hangLoi: "DA_XU_LY", hangLoiNcc: "HON_HOP" }), "Đã trả và tiêu hủy");
  assert.equal(tienTruDaChot({ tienTru: 0, tongGiaTri: 2000000 }), null);
  assert.equal(tienTruDaChot({ tienTru: "1640000" }), 1640000);
});

test("loiNguoiXacNhan: bắt buộc, theo luật họ tên", () => {
  assert.equal(loiNguoiXacNhan(""), "Nhập tên người xác nhận");
  assert.equal(loiNguoiXacNhan("   "), "Nhập tên người xác nhận");
  assert.equal(loiNguoiXacNhan("Trần Thị Thu Hà"), "");
  assert.equal(loiNguoiXacNhan("A"), "Họ tên cần ít nhất 2 ký tự");
  assert.equal(loiNguoiXacNhan("Hà 123"), "Họ tên chỉ gồm chữ cái và dấu cách");
  assert.equal(loiNguoiXacNhan("a".repeat(101)), "Họ tên tối đa 100 ký tự");
});

test("cachXuLyLichSu: biên bản dòng trừ tiền dòng giao bù", () => {
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "HON_HOP", tienTru: 33000, buXong: false, conChoGiao: 1 }), { loai: "hon", tien: 33000, xong: false, conLai: 1 });
  assert.deepEqual(cachXuLyLichSu({ phuongAn: "HON_HOP", tienTru: 0, buXong: true, conChoGiao: 0 }), { loai: "hon", tien: null, xong: true, conLai: 0 });
});

// Biên bản 3 dòng như dữ liệu thật: rách vải (2), sai màu (1), ố bẩn (1) — chưa trả lời, phiếu chưa nhập kho
const MO_CB = ["DOI_HANG", "TRU_CONG_NO"];
const MO_HL = ["NHAN_LAI", "TIEU_HUY"];
const dongMoi = (id, soLuong, giaTri, them = {}) => ({
  id, soLuong, giaTri, cachBu: "CHO_CHOT", hangLoi: null, viTriHang: "O_KHO", cachBuMo: MO_CB, hangLoiMo: MO_HL, ...them,
});
const bbMoi = () => ({ dong: [dongMoi(1, 2, 300000), dongMoi(2, 1, 150000), dongMoi(3, 1, 120000)] });

test("lần đầu: mọi dòng thiếu đủ hai câu, chọn từng dòng thì hết thiếu", () => {
  const bb = bbMoi();
  let chon = khoiTaoLuaChon(bb);
  assert.deepEqual(chon[1], { cachBu: null, hangLoi: null });
  assert.deepEqual(dongConThieu(bb, chon), [1, 2, 3]);
  assert.equal(trangThaiTheDong(bb.dong[0], chon[1]), "chua-chon");
  chon = { ...chon, 1: { cachBu: "TRU_CONG_NO", hangLoi: null } };
  assert.equal(trangThaiTheDong(bb.dong[0], chon[1]), "thieu-mot");
  chon = { ...chon, 1: { cachBu: "TRU_CONG_NO", hangLoi: "TIEU_HUY" }, 2: { cachBu: "DOI_HANG", hangLoi: "NHAN_LAI" } };
  assert.equal(trangThaiTheDong(bb.dong[0], chon[1]), "da-chon");
  assert.deepEqual(dongConThieu(bb, chon), [3]);
  assert.equal(coDongDoi(bb, chon), true);
});

test("tóm tắt cộng dồn theo sản phẩm (cái), tiền trừ theo giá trị từng dòng", () => {
  const bb = bbMoi();
  const chon = {
    1: { cachBu: "TRU_CONG_NO", hangLoi: "TIEU_HUY" },
    2: { cachBu: "DOI_HANG", hangLoi: "NHAN_LAI" },
    3: { cachBu: "TRU_CONG_NO", hangLoi: null },
  };
  assert.deepEqual(tomTatLuaChon(bb, chon), {
    truTien: { soLuong: 3, tien: 420000 }, giaoBu: 1, coiNhuDaBu: 0, nhanLai: 1, tieuHuy: 2, daRoiKho: 0, chuaChon: 1,
  });
  assert.equal(soTieuHuyMoi(bb, chon), 2);
  assert.equal(soSanPhamConThieu(bb, chon), 1, "đếm theo sản phẩm của dòng còn thiếu");
  assert.equal(soSanPhamConThieu(bb, khoiTaoLuaChon(bb)), 4);
});

test("tóm tắt: dòng máy chủ trừ một phần, hàng lỗi đã rời kho, lựa chọn bị khóa không được cộng", () => {
  const bb = {
    dong: [
      // Quá hạn: đơn chỉ còn chờ 1 trong 2 → trừ 1, 1 coi như đã giao bù
      dongMoi(1, 2, 300000, { cachBu: "TRU_CONG_NO", nguonCachBu: "TU_DONG", soLuongTru: 1, tienTru: 150000, donGia: 150000, cachBuMo: [], hangLoi: "NHAN_LAI" }),
      // Hàng lỗi đã giao trả: không vào nhận lại / tiêu hủy
      dongMoi(2, 1, 150000, { cachBu: "DOI_HANG", hangLoi: "NHAN_LAI", viTriHang: "DA_TRA", cachBuMo: [], hangLoiMo: [] }),
      // Đã nhập kho trừ tiền (chốt): chọn giao bù trên thẻ không được tính
      dongMoi(3, 1, 120000, { cachBu: "TRU_CONG_NO", soLuongTru: 1, tienTru: 120000, cachBuMo: [], hangLoi: "TIEU_HUY" }),
    ],
  };
  const chon = { 3: { cachBu: "DOI_HANG", hangLoi: "TIEU_HUY" } };
  assert.deepEqual(luaChonHieuLuc(bb.dong[2], chon[3]), { cachBu: "TRU_CONG_NO", hangLoi: "TIEU_HUY" });
  assert.deepEqual(tomTatLuaChon(bb, chon), {
    truTien: { soLuong: 2, tien: 270000 }, giaoBu: 1, coiNhuDaBu: 1, nhanLai: 2, tieuHuy: 1, daRoiKho: 1, chuaChon: 0,
  });
  // Dòng vừa chọn trừ tiền: cả dòng theo giá trị; thiếu đơn giá thì 0 (giao diện không hiện "−0 ₫")
  assert.deepEqual(truTienDong(dongMoi(4, 2, 300000), "TRU_CONG_NO"), { soLuong: 2, tien: 300000 });
  assert.deepEqual(truTienDong(dongMoi(5, 2, null), "TRU_CONG_NO"), { soLuong: 2, tien: 0 });
  assert.deepEqual(truTienDong(dongMoi(6, 2, 1), "DOI_HANG"), { soLuong: 0, tien: 0 });
});

test("dòng thiếu id: chỉ xem, không tính thiếu, không gửi", () => {
  const bb = { dong: [dongMoi(1, 1, 100), { ...dongMoi(null, 3, 300) }] };
  const chon = { ...khoiTaoLuaChon(bb), 1: { cachBu: "DOI_HANG", hangLoi: "NHAN_LAI" } };
  assert.deepEqual(Object.keys(khoiTaoLuaChon(bb)), ["1"]);
  assert.deepEqual(dongConThieu(bb, chon), []);
  assert.equal(soDongMo(bb, "cachBu"), 1);
  assert.deepEqual(taoPayloadTheoDong(bb, chon, "Hà", "").dong, [{ id: 1, phuongAn: "DOI_HANG", hangLoi: "NHAN_LAI" }]);
});

test("chữ ký dữ liệu đổi khi lựa chọn / lựa chọn còn mở / lần lập đổi", () => {
  const bb = { ...bbMoi(), phienBan: 7 };
  const goc = chuKyLuaChon(bb);
  assert.equal(chuKyLuaChon({ ...bbMoi(), phienBan: 7 }), goc);
  assert.notEqual(chuKyLuaChon({ ...bb, phienBan: 8 }), goc);
  const doi = bbMoi();
  doi.dong[0] = { ...doi.dong[0], cachBu: "TRU_CONG_NO", cachBuMo: [] };
  assert.notEqual(chuKyLuaChon({ ...doi, phienBan: 7 }), goc);
});

test("áp dụng nhanh: đặt mọi dòng còn chọn được, dòng đã chốt giữ nguyên và được đếm", () => {
  const bb = bbMoi();
  // Dòng 3 đã nhập kho trừ tiền: cách bù chốt
  bb.dong[2] = { ...bb.dong[2], cachBu: "TRU_CONG_NO", cachBuMo: [] };
  const { chon, boQua } = apDungNhanh(bb, khoiTaoLuaChon(bb), "cachBu", "DOI_HANG");
  assert.equal(chon[1].cachBu, "DOI_HANG");
  assert.equal(chon[2].cachBu, "DOI_HANG");
  assert.equal(chon[3].cachBu, "TRU_CONG_NO");
  assert.equal(boQua, 1);
  assert.equal(giaTriChung(bb, chon, "cachBu"), "DOI_HANG", "bỏ qua dòng đã chốt khi xét nút đang bật");
  assert.equal(soDongMo(bb, "cachBu"), 2);
  // Hàng lỗi đã rời kho không tính vào số giữ nguyên
  bb.dong[1] = { ...bb.dong[1], viTriHang: "DA_TRA", hangLoiMo: [] };
  assert.equal(apDungNhanh(bb, khoiTaoLuaChon(bb), "hangLoi", "TIEU_HUY").boQua, 0);
  // Dòng chưa từng chọn mà đã khóa (đơn mua đã kết thúc): không phải "giữ lựa chọn cũ"
  const khoa = bbMoi();
  khoa.dong[0] = { ...khoa.dong[0], cachBuMo: [] };
  assert.equal(apDungNhanh(khoa, khoiTaoLuaChon(khoa), "cachBu", "DOI_HANG").boQua, 0);
});

test("áp dụng nhanh đúng lựa chọn đang áp dụng (chỉ còn đổi sang trừ tiền): đưa dòng về lựa chọn cũ", () => {
  const bb = bbMoi();
  // Đã nhập kho, dòng 1 giao bù: chỉ còn đổi sang trừ tiền
  bb.dong[0] = { ...bb.dong[0], cachBu: "DOI_HANG", cachBuMo: ["TRU_CONG_NO"] };
  let chon = apDungNhanh(bb, khoiTaoLuaChon(bb), "cachBu", "TRU_CONG_NO").chon;
  assert.equal(chon[1].cachBu, "TRU_CONG_NO");
  const kq = apDungNhanh(bb, chon, "cachBu", "DOI_HANG");
  assert.equal(kq.chon[1].cachBu, "DOI_HANG", "về giao bù đang áp dụng");
  assert.equal(kq.boQua, 0);
});

test("canChon / chọn lại sau nhập kho", () => {
  const d = dongMoi(9, 2, 1, { cachBu: "CHO_CHOT", nguonCachBu: "NHAP_KHO", hangLoi: "NHAN_LAI" });
  assert.deepEqual(canChon(d), { cachBu: true, hangLoi: false });
  assert.equal(trangThaiTheDong(d, { cachBu: null, hangLoi: "NHAN_LAI" }), "chon-lai");
  assert.equal(trangThaiTheDong({ ...d, cachBu: "TRU_CONG_NO", cachBuMo: [], hangLoiMo: [] }, { cachBu: "TRU_CONG_NO", hangLoi: "NHAN_LAI" }), "da-chot");
});

test("taoPayloadTheoDong: chỉ dòng / câu có đổi, chuẩn hóa tên, cắt ghi chú 255", () => {
  const bb = bbMoi();
  bb.dong[2] = { ...bb.dong[2], cachBu: "DOI_HANG", hangLoi: "NHAN_LAI" };
  const chon = {
    1: { cachBu: "TRU_CONG_NO", hangLoi: "TIEU_HUY" },
    2: { cachBu: "DOI_HANG", hangLoi: "NHAN_LAI" },
    3: { cachBu: "DOI_HANG", hangLoi: "TIEU_HUY" },
  };
  assert.deepEqual(taoPayloadTheoDong(bb, chon, "  Trần   Thị Hà ", "  ", 7, true), {
    dong: [
      { id: 1, phuongAn: "TRU_CONG_NO", hangLoi: "TIEU_HUY" },
      { id: 2, phuongAn: "DOI_HANG", hangLoi: "NHAN_LAI" },
      { id: 3, phuongAn: null, hangLoi: "TIEU_HUY" },
    ],
    nguoiXacNhan: "Trần Thị Hà",
    ghiChu: null,
    phienBan: 7,
    camKet: true,
  });
  assert.equal(taoPayloadTheoDong(bb, chon, "Hà Lan", "x".repeat(300)).ghiChu.length, 255);
  // Câu đã chốt không gửi dù lựa chọn khác
  const chot = { dong: [{ ...dongMoi(1, 1, 1), cachBu: "TRU_CONG_NO", cachBuMo: [] }] };
  assert.deepEqual(taoPayloadTheoDong(chot, { 1: { cachBu: "DOI_HANG", hangLoi: "NHAN_LAI" } }, "Hà", "").dong, [{ id: 1, phuongAn: null, hangLoi: "NHAN_LAI" }]);
});

test("thuocTinhDong", () => {
  assert.equal(thuocTinhDong({ mauSac: "Đen", kichCo: "S" }), "Đen · S");
  assert.equal(thuocTinhDong({ mauSac: "", kichCo: null }), "");
});
