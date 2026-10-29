// Chạy: node --test src/pages/dashboard/admin/tong-quan/tongQuan.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { bienDong, formatTienNgan, tachTien } from "./tongQuanFormat.js";
import { diemDaTron, giaTriDiem, tongHopKy, vachTruc } from "./tongQuanSoLieu.js";
import { danhSachViec, duongDanLoiDongBo } from "./viecCanXuLy.js";

// Intl dùng khoảng trắng hẹp/thường tùy máy: so sánh sau khi gom khoảng trắng
const gon = (s) => s.replace(/\s/g, " ");

test("tiền: dưới 1 triệu ghi đủ, từ 1 triệu và 1 tỷ rút gọn, không dùng nghìn", () => {
  assert.deepEqual(tachTien(495000), { so: "495.000", donVi: "₫" });
  assert.equal(gon(formatTienNgan(17820000)), "17,8 triệu ₫");
  assert.equal(gon(formatTienNgan(2486300000)), "2,49 tỷ ₫");
  assert.equal(gon(formatTienNgan(0)), "0 ₫");
});

test("biến động: có dấu, kỳ trước 0 thì không ghi, gần 0 là 0% trung tính", () => {
  assert.deepEqual(bienDong(110, 100), { tang: true, chu: "+10%" });
  assert.deepEqual(bienDong(87.6, 100), { tang: false, chu: "−12,4%" });
  assert.equal(bienDong(100, 0), null);
  assert.equal(bienDong(100, null), null);
  assert.deepEqual(bienDong(100.01, 100), { tang: null, chu: "0%" });
});

test("trục tung: bước đẹp, luôn có 0, phủ cả số âm, số đơn là số nguyên", () => {
  assert.deepEqual(vachTruc(0, 36.6e6, false), { ticks: [0, 1e7, 2e7, 3e7, 4e7], day: 0, dinh: 4e7 });
  const am = vachTruc(-9.5e6, 7.9e6, false);
  assert.ok(am.ticks.includes(0));
  assert.ok(am.day <= -9.5e6 && am.dinh >= 7.9e6);
  assert.deepEqual(vachTruc(0, 3, true).ticks, [0, 1, 2, 3]);
  assert.deepEqual(vachTruc(0, 0.6e6, false).ticks, [0, 2e5, 4e5, 6e5]);
  // Không có số liệu: vẫn có trục hợp lệ
  assert.ok(vachTruc(0, 0, false).dinh > 0);
});

const dt = {
  tongDoanhThu: 300,
  tongLoiNhuan: 60,
  tongSoDon: 3,
  doanhThuKyTruoc: 200,
  diem: [
    { tu: "2026-10-15", doanhThu: 100, loiNhuan: 20, soDon: 1, chuaKetThuc: false },
    { tu: "2026-10-16", doanhThu: 200, loiNhuan: 40, soDon: 2, chuaKetThuc: false },
    { tu: "2026-10-17", doanhThu: 50, loiNhuan: 10, soDon: 1, chuaKetThuc: true },
  ],
  diemKyTruoc: [
    { tu: "2026-10-13", doanhThu: 200, loiNhuan: 30, soDon: 4, chuaKetThuc: false },
    { tu: "2026-10-14", doanhThu: 0, loiNhuan: 0, soDon: 0, chuaKetThuc: false },
  ],
};

test("tổng của kỳ và kỳ trước; bỏ ngày đang chạy", () => {
  assert.equal(diemDaTron(dt).length, 2);
  const { nay, truoc } = tongHopKy(dt);
  assert.deepEqual(nay, { doanhThu: 300, loiNhuan: 60, soDon: 3, tbDon: 100 });
  assert.deepEqual(truoc, { doanhThu: 200, loiNhuan: 30, soDon: 4, tbDon: 50 });
  // Máy chủ cũ chưa có diemKyTruoc: chỉ so được doanh thu
  const { truoc: cu } = tongHopKy({ ...dt, diemKyTruoc: undefined });
  assert.deepEqual(cu, { doanhThu: 200 });
});

test("giá trị đơn trung bình của ngày không có đơn là null (bỏ trống, không vẽ 0)", () => {
  assert.equal(giaTriDiem(dt.diemKyTruoc[1], "tbDon"), null);
  assert.equal(giaTriDiem(dt.diem[1], "tbDon"), 100);
  assert.equal(giaTriDiem(dt.diem[1], "loiNhuan"), 40);
});

const viec = {
  donNhapChuaGuiKho: 0, donChoXuatKho: 12, phieuNhatChuaPhanCong: 0, phieuXuatChoXuatKho: 5, yeuCauNhapChoDuyet: 0,
  phieuNhapChoNhapKho: 1, phieuChuyenChoDuyet: 0, phieuChuyenChoXuatHang: 0, dotKiemKeDangMo: 0, hetHang: 3, thieuHang: 4,
  taiKhoanBiKhoa: 1,
  theoKho: [
    { khoId: 1, tenKho: "Kho tổng", donChoXuatKho: 9, phieuNhatChuaPhanCong: 0, phieuChuyenChoDuyet: 0, phieuChuyenChoXuatHang: 0 },
    { khoId: 2, tenKho: "Cửa hàng Hà Nội", donChoXuatKho: 3, phieuNhatChuaPhanCong: 0, phieuChuyenChoDuyet: 0, phieuChuyenChoXuatHang: 0 },
  ],
  donMuaQuaHan: 2,
  loiDongBo: [{ kenhId: 7, maKenh: "SHOPIFY", tenKenh: "Cửa hàng Shopify", soLoi: 3 }],
};

test("cần xử lý: việc gấp lên đầu, không có dòng hết/thiếu hàng, tách theo kho khi xem tất cả kho", () => {
  const ds = danhSachViec(viec, null);
  assert.deepEqual(ds.map((d) => d.key), [
    "loiDongBo-7", "donMuaQuaHan", "donChoXuatKho-1", "donChoXuatKho-2", "phieuXuatChoXuatKho", "phieuNhapChoNhapKho", "taiKhoanBiKhoa",
  ]);
  assert.ok(!ds.some((d) => /hết|thiếu/i.test(d.ten)), "hết/thiếu hàng đã ở thẻ Tồn kho");
  assert.equal(ds[0].to, "/channels/shopify/products?trangThai=loi");
  assert.equal(ds.find((d) => d.key === "donChoXuatKho-2").kho, 2);
});

test("cần xử lý khi xem một kho: bỏ việc chung của hệ thống, liên kết mang kho", () => {
  const ds = danhSachViec(viec, 2);
  assert.ok(!ds.some((d) => d.loai === "loiDongBo" || d.loai === "taiKhoanBiKhoa"));
  assert.equal(ds.find((d) => d.loai === "donMuaQuaHan").to, "/purchase-orders?trangThai=dang-van-chuyen&kho=2");
  assert.equal(ds.find((d) => d.loai === "donChoXuatKho").kho, 2);
});

test("cần xử lý: phiếu chuyển chờ xử lý chênh lệch mở tab đúng, không tách theo kho; máy chủ cũ chưa trả thì không hiện", () => {
  for (const khoId of [null, 2]) {
    const ds = danhSachViec({ ...viec, phieuChuyenChoXuLyLech: 3 }, khoId);
    const lech = ds.filter((d) => d.loai === "phieuChuyenChoXuLyLech");
    assert.equal(lech.length, 1);
    assert.equal(lech[0].so, 3);
    assert.equal(lech[0].muc, "warn");
    assert.equal(lech[0].to, "/transfer-tickets?trangThai=cho-xu-ly-chenh-lech");
    assert.equal(lech[0].kho, undefined, "quản trị viên xem phiếu chuyển của mọi kho, không đổi kho làm việc");
  }
  assert.ok(!danhSachViec(viec, null).some((d) => d.loai === "phieuChuyenChoXuLyLech"));
});

test("máy chủ cũ chưa có lỗi đồng bộ và đơn mua quá hạn: không hiện hai dòng đó", () => {
  const { loiDongBo, donMuaQuaHan, ...cu } = viec;
  assert.equal(loiDongBo.length + donMuaQuaHan > 0, true);
  const ds = danhSachViec(cu, null);
  assert.ok(!ds.some((d) => d.loai === "loiDongBo" || d.loai === "donMuaQuaHan"));
  // Sàn chưa có trang riêng (Shopee) mở danh sách kênh; Lazada đã có trang Sản phẩm riêng (KH Lazada/TikTok mục B.1)
  assert.equal(duongDanLoiDongBo("SHOPEE"), "/channels");
  assert.equal(duongDanLoiDongBo("LAZADA"), "/channels/lazada/products?trangThai=loi");
});
