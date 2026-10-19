import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KENH_BAN_THUONG,
  cachDay,
  dieuKienBaoGia,
  dieuKienDon,
  ghiChuBaoGia,
  ghiChuPhamVi,
  laHoatDong,
  luaChonKenh,
  moTaKenhMua,
  ngayBatDau,
  nhanDiaChi,
  nhanLoaiKhach,
  tinhKpi,
  tongSoDon,
} from "./tinhKhachHang.js";

const HOM_NAY = new Date("2026-10-18T09:00:00");
// Số tiền theo cách hiển thị của formatCurrency (vi-VN, có ký hiệu ₫ và khoảng trắng không ngắt)
const tien = (n) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const TONG_QUAN = {
  soDonDat: 12,
  soDonTinhChiTieu: 10,
  soDonHuy: 1,
  soDonHoanTra: 1,
  soDonNhap: 1,
  soDonDangXuLy: 4,
  tongChiTieu: 159800000,
  trungBinhMoiDon: 15980000,
  donGanNhat: { id: 9, soDonHang: "SO202610162", ngayDatHang: "2026-10-16T03:15:00Z" },
  kenhMua: [
    { id: null, maKenh: null, tenKenh: null, soDon: 10 },
    { id: 2, maKenh: "SHOPIFY", tenKenh: "Shopify", soDon: 2 },
  ],
};

test("loại khách, trạng thái, nhãn địa chỉ", () => {
  assert.equal(nhanLoaiKhach("si"), "Khách sỉ");
  assert.equal(nhanLoaiKhach("doanh_nghiep"), "Doanh nghiệp");
  assert.equal(nhanLoaiKhach(""), null);
  assert.equal(nhanLoaiKhach("la"), null);
  assert.equal(laHoatDong({ trangThai: 1 }), true);
  assert.equal(laHoatDong({ trangThai: "1" }), true);
  assert.equal(laHoatDong({ trangThai: 0 }), false);
  assert.equal(laHoatDong(null), false);
  assert.equal(nhanDiaChi("doanh_nghiep"), "Địa chỉ trụ sở");
  assert.equal(nhanDiaChi("le"), "Địa chỉ giao hàng");
});

test("ngày bắt đầu của N ngày qua theo giờ máy", () => {
  assert.equal(ngayBatDau("30", HOM_NAY), "2026-09-18");
  assert.equal(ngayBatDau(365, HOM_NAY), "2025-10-18");
  assert.equal(ngayBatDau(90, new Date("2026-03-01T00:30:00")), "2025-12-01");
});

test("điều kiện lọc đơn: chỉ đơn bán của khách khi không lọc", () => {
  assert.deepEqual(dieuKienDon({ khachHangId: "16" }), [
    { fieldName: "khachHang.id", operation: "EQUALS", value: 16 },
    { fieldName: "loaiChungTu", operation: "EQUALS", value: "don_ban_hang" },
  ]);
});

test("điều kiện lọc đơn: từ khóa tìm cả mã đơn sàn, kênh và thời gian", () => {
  const dk = dieuKienDon({ khachHangId: 16, tuKhoa: "  1016 ", kenh: "2", thoiGian: "30", homNay: HOM_NAY });
  assert.deepEqual(dk.slice(2), [
    { fieldName: "soDonHang", operation: "LIKE", value: "1016", logicType: "OR" },
    { fieldName: "maDonHangKenh", operation: "LIKE", value: "1016", logicType: "OR" },
    { fieldName: "kenhBanHang.id", operation: "EQUALS", value: 2 },
    { fieldName: "ngayDatHang", operation: "GREATER_THAN_OR_EQUAL", value: "2026-09-18" },
  ]);
});

test("điều kiện lọc đơn: bán thường là đơn không gắn kênh, từ khóa toàn khoảng trắng bỏ qua", () => {
  const dk = dieuKienDon({ khachHangId: 16, tuKhoa: "   ", kenh: KENH_BAN_THUONG });
  assert.deepEqual(dk.slice(2), [{ fieldName: "kenhBanHang", operation: "IS_NULL" }]);
});

test("điều kiện lọc báo giá", () => {
  assert.deepEqual(dieuKienBaoGia("16"), [
    { fieldName: "khachHang.id", operation: "EQUALS", value: 16 },
    { fieldName: "loaiChungTu", operation: "EQUALS", value: "bao_gia" },
  ]);
});

test("lựa chọn kênh lấy từ kênh khách đã mua, mô tả Mua qua", () => {
  assert.deepEqual(luaChonKenh(TONG_QUAN.kenhMua), [
    { value: "", label: "Tất cả kênh" },
    { value: KENH_BAN_THUONG, label: "Bán thường" },
    { value: "2", label: "Shopify" },
  ]);
  assert.deepEqual(luaChonKenh(undefined), [{ value: "", label: "Tất cả kênh" }]);
  assert.equal(moTaKenhMua(TONG_QUAN.kenhMua), "Bán thường, Shopify");
  assert.equal(moTaKenhMua([{ id: 1, maKenh: "POS", tenKenh: "" }]), "POS");
  assert.equal(moTaKenhMua([]), "—");
});

test("cách đây theo ngày lịch", () => {
  assert.equal(cachDay("2026-10-18T01:00:00", HOM_NAY), "hôm nay");
  assert.equal(cachDay("2026-10-17T23:59:00", HOM_NAY), "hôm qua");
  assert.equal(cachDay("2026-10-08T10:00:00", HOM_NAY), "10 ngày trước");
  assert.equal(cachDay(null, HOM_NAY), "");
  assert.equal(cachDay("không phải ngày", HOM_NAY), "");
});

test("tổng số đơn trên tab gồm cả đơn nháp", () => {
  assert.equal(tongSoDon(TONG_QUAN), 13);
  assert.equal(tongSoDon(undefined), 0);
});

test("bốn ô tình hình mua hàng của khách đã mua", () => {
  const [chiTieu, soDon, trungBinh, ganNhat] = tinhKpi(TONG_QUAN, HOM_NAY);
  assert.equal(chiTieu.giaTri, tien(159800000));
  assert.equal(chiTieu.phu, "Từ 10 đơn, không tính hủy và hoàn trả");
  assert.equal(soDon.giaTri, "12");
  assert.equal(soDon.phu, "1 đã hủy · 1 bị hoàn trả · 1 nháp chưa tính");
  assert.equal(trungBinh.giaTri, tien(15980000));
  assert.equal(trungBinh.phu, "Trên 10 đơn tính chi tiêu");
  assert.equal(ganNhat.giaTri, "16/10/2026");
  assert.equal(ganNhat.phu, "2 ngày trước");
  assert.equal(ganNhat.donGanNhat.soDonHang, "SO202610162");
  assert.ok([chiTieu, soDon, trungBinh, ganNhat].every((o) => o.coGiaTri));
});

test("khách chưa mua: bốn ô đều trống", () => {
  const kpi = tinhKpi({ soDonDat: 0, soDonTinhChiTieu: 0, soDonNhap: 0, tongChiTieu: 0, donGanNhat: null }, HOM_NAY);
  assert.ok(kpi.every((o) => o.giaTri === "—" && !o.coGiaTri && o.phu === "Chưa có đơn hàng"));
});

test("chỉ có đơn nháp: chưa tính là đã mua", () => {
  const kpi = tinhKpi({ soDonDat: 0, soDonTinhChiTieu: 0, soDonNhap: 2, tongChiTieu: 0 }, HOM_NAY);
  assert.ok(kpi.every((o) => o.giaTri === "—" && o.phu === "2 đơn nháp chưa tính"));
});

test("chỉ có đơn đã hủy: có số đơn nhưng chưa có trung bình", () => {
  const [chiTieu, soDon, trungBinh] = tinhKpi(
    { soDonDat: 2, soDonTinhChiTieu: 0, soDonHuy: 2, soDonNhap: 0, tongChiTieu: 0, trungBinhMoiDon: null },
    HOM_NAY,
  );
  assert.equal(chiTieu.giaTri, tien(0));
  assert.equal(soDon.phu, "2 đã hủy");
  assert.equal(trungBinh.giaTri, "—");
  assert.equal(trungBinh.phu, "Chưa có đơn tính chi tiêu");
});

test("không có đơn hủy hay hoàn trả", () => {
  const [, soDon] = tinhKpi({ soDonDat: 3, soDonTinhChiTieu: 3, tongChiTieu: 300, trungBinhMoiDon: 100 }, HOM_NAY);
  assert.equal(soDon.phu, "Không có đơn hủy hay hoàn trả");
});

test("ghi chú báo giá và phạm vi theo vai trò", () => {
  assert.equal(ghiChuBaoGia({ trangThai: 4, lyDoTuChoi: " giá chưa phù hợp ", ghiChu: "x" }), "Lý do: giá chưa phù hợp");
  assert.equal(ghiChuBaoGia({ trangThai: 4, lyDoTuChoi: "", ghiChu: "Gửi lại tuần sau" }), "Gửi lại tuần sau");
  assert.equal(ghiChuBaoGia({ trangThai: 0, ghiChu: null }), "");
  assert.equal(ghiChuPhamVi({ laQuanTriVien: true, laVaiTroKho: true }), "");
  assert.equal(ghiChuPhamVi({ laVaiTroKho: true, laBanHang: true }), "Chỉ tính đơn xuất từ kho bạn phụ trách.");
  assert.equal(ghiChuPhamVi({ laBanHang: true }), "Chỉ tính đơn do bạn tạo.");
});
