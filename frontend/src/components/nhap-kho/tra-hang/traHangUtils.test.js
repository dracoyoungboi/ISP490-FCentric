// Chạy: node --test src/components/nhap-kho/tra-hang/traHangUtils.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { cachBuDong, choKyBienBan, dongKhoCanLam, hangLoiDong, lichSuBienBan, moTaHangLoi, moTaKy, tenNguoiGiao, viecKho } from "./traHangUtils.js";

const bb = (them = {}) => ({
  id: 1,
  trangThai: "CHO_TRA_HANG",
  cachXuLyHang: "GIU_KHO",
  trangThaiHang: "O_KHO",
  benKy: "DAI_DIEN_NCC",
  nguoiGiao: "Lê Văn Tài",
  bienSoXe: "29C-123.45",
  nguoiLap: "Lê Kho",
  ngayLap: "2026-11-23T03:00:00Z",
  tongSoLuongLoi: 2,
  ...them,
});

test("choKyBienBan: chỉ khi chờ ký và biên bản còn hiệu lực", () => {
  assert.equal(choKyBienBan(bb({ kyBienBan: "CHO_KY" })), true);
  assert.equal(choKyBienBan(bb({ kyBienBan: "CHO_KY", trangThai: "DA_HUY" })), false);
  assert.equal(choKyBienBan(bb({ kyBienBan: "DA_KY" })), false);
  assert.equal(choKyBienBan(bb({ kyBienBan: null })), false, "biên bản cũ không có bước ký");
  assert.equal(choKyBienBan(null), false);
});

test("tenNguoiGiao: đơn vị chỉ khi người của bên vận chuyển", () => {
  assert.equal(tenNguoiGiao(bb()), "Lê Văn Tài · 29C-123.45");
  assert.equal(tenNguoiGiao(bb({ bienSoXe: null, donViVanChuyen: "Nhà xe A" })), "Lê Văn Tài", "đại diện nhà cung cấp: bỏ đơn vị");
  assert.equal(tenNguoiGiao(bb({ benKy: "VAN_CHUYEN", donViVanChuyen: "Nhà xe Phương Trang" })), "Lê Văn Tài · Nhà xe Phương Trang · 29C-123.45");
});

test("moTaKy theo bên ký và việc ký", () => {
  assert.equal(moTaKy(bb({ kyBienBan: "CHO_KY" })), "Chờ Lê Văn Tài · 29C-123.45 ký");
  assert.equal(moTaKy(bb({ kyBienBan: "DA_KY" })), "Lê Văn Tài · 29C-123.45 đã ký (đại diện nhà cung cấp)");
  assert.equal(moTaKy(bb({ kyBienBan: "DA_KY", benKy: "VAN_CHUYEN", donViVanChuyen: "Viettel Post", bienSoXe: null })), "Lê Văn Tài · Viettel Post đã ký (bên vận chuyển)");
  assert.equal(moTaKy(bb({ kyBienBan: null })), "");
});

test("moTaHangLoi: giao luôn chờ ký chưa phải đã trả", () => {
  assert.equal(moTaHangLoi(bb({ cachXuLyHang: "TRA_NGAY", kyBienBan: "CHO_KY" })), "chờ Lê Văn Tài ký nhận");
  assert.equal(
    moTaHangLoi(bb({ cachXuLyHang: "TRA_NGAY", kyBienBan: "DA_KY", trangThaiHang: "DA_TRA", nguoiNhanHang: "Lê Văn Tài" })),
    "trả ngay cho người giao hàng Lê Văn Tài",
  );
});

test("viecKho: chờ ký thì kho chưa có việc giao trả / tiêu hủy", () => {
  assert.equal(viecKho(bb({ kyBienBan: "CHO_KY", phieuDaNhap: false })), null);
  assert.equal(viecKho(bb({ kyBienBan: "DA_KY", phieuDaNhap: true, hangLoiNcc: "NHAN_LAI" })), "giaoTra");
});

test("lichSuBienBan: có dòng ghi đã ký, sắp theo thời gian", () => {
  const ds = lichSuBienBan(bb({
    kyBienBan: "DA_KY",
    benKy: "VAN_CHUYEN",
    donViVanChuyen: "Nhà xe Phương Trang",
    thoiDiemKy: "2026-11-23T03:10:00Z",
    nguoiGhiKy: "Lê Kho",
    emailGuiLuc: "2026-11-23T03:11:00Z",
    emailNcc: "ncc@vd.vn",
  }));
  assert.deepEqual(ds.map((d) => d.luc), ["2026-11-23T03:00:00Z", "2026-11-23T03:10:00Z", "2026-11-23T03:11:00Z"]);
  assert.equal(ds[1].noiDung, "Lê Kho ghi Lê Văn Tài · Nhà xe Phương Trang · 29C-123.45 đã ký biên bản");

  const traNgay = lichSuBienBan(bb({ cachXuLyHang: "TRA_NGAY", kyBienBan: "DA_KY", thoiDiemKy: "2026-11-23T03:10:00Z", nguoiGhiKy: "Lê Kho" }));
  assert.equal(traNgay[0].noiDung, "Lê Kho lập biên bản, giao luôn cho Lê Văn Tài");
  assert.equal(traNgay[1].noiDung, "Lê Kho ghi Lê Văn Tài · 29C-123.45 đã ký biên bản và nhận hàng lỗi");

  assert.equal(lichSuBienBan(bb({ kyBienBan: "CHO_KY" })).length, 1, "chờ ký: chỉ có dòng lập");
});

test("dongKhoCanLam / viecKho: theo lựa chọn từng dòng, danh sách không kèm dòng thì theo số của đầu biên bản", () => {
  const nhap = { phieuDaNhap: true, trangThaiHang: "O_KHO" };
  const coDong = bb({
    ...nhap,
    hangLoiNcc: "HON_HOP",
    items: [
      { id: 1, soLuong: 2, trangThaiHang: "O_KHO", hangLoiNcc: "TIEU_HUY" },
      { id: 2, soLuong: 1, trangThaiHang: "O_KHO", hangLoiNcc: "NHAN_LAI" },
      { id: 3, soLuong: 4, trangThaiHang: "DA_TRA", hangLoiNcc: "NHAN_LAI" },
      { id: 4, soLuong: 1, trangThaiHang: "O_KHO", hangLoiNcc: null },
    ],
  });
  const v = dongKhoCanLam(coDong);
  assert.deepEqual(v.giaoTra.dong.map((d) => d.id), [2], "dòng đã giao trả không tính lại");
  assert.equal(v.giaoTra.soLuong, 1);
  assert.deepEqual(v.tieuHuy.dong.map((d) => d.id), [1]);
  assert.equal(viecKho(coDong), "giaoTra");
  // Danh sách (không kèm dòng): số của đầu biên bản
  assert.equal(viecKho(bb({ ...nhap, hangLoiNcc: "HON_HOP", soLuongNhanLai: 0, soLuongTieuHuy: 3 })), "tieuHuy");
  // Biên bản cũ một lựa chọn cho cả biên bản
  assert.equal(viecKho(bb({ ...nhap, hangLoiNcc: "NHAN_LAI" })), "giaoTra");
  assert.equal(viecKho(bb({ ...nhap, phieuDaNhap: false, hangLoiNcc: "NHAN_LAI" })), null, "phiếu chưa nhập kho");
  assert.equal(viecKho(bb({ ...nhap, trangThaiHang: "DA_XU_LY", hangLoiNcc: "HON_HOP" })), null);
});

test("cachBuDong / hangLoiDong: chữ trong ô Nhà cung cấp chọn của từng dòng", () => {
  assert.deepEqual(cachBuDong({ cachBu: "CHO_CHOT", nguonCachBu: "NHAP_KHO" }), { ten: "Chờ chọn lại", phu: null, cho: true });
  assert.equal(cachBuDong({ cachBu: "TRU_CONG_NO", nguonCachBu: "TU_DONG", giaTri: 30000 }).phu, "quá hạn trả lời · −30.000\u00a0₫");
  assert.equal(cachBuDong({ cachBu: "DOI_HANG", buXong: true }, { phieuDaNhap: true }).phu, "đã nhận đủ hàng bù");
  assert.equal(cachBuDong({ cachBu: null }), null, "biên bản chờ ký");
  assert.deepEqual(hangLoiDong({ trangThaiHang: "DA_TRA", nguoiNhanHang: "Nhà xe A" }), { ten: "Đã giao trả", phu: "Nhà xe A", cho: false });
  assert.equal(hangLoiDong({ trangThaiHang: "O_KHO", hangLoiNcc: null }).cho, true);
  assert.equal(hangLoiDong({ trangThaiHang: "O_KHO", hangLoiNcc: "TIEU_HUY" }).ten, "Đồng ý tiêu hủy");
});
