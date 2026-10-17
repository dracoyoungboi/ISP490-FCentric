import { test } from "node:test";
import assert from "node:assert/strict";
import { cauNgungHoatDong, gopKhuVuc, nhanMucDay, nhanPhanQuyen, taoOSo, tomTatKe } from "./chiTietKho.js";

const khoTong = { id: 1, maKho: "KHO_TONG", tenKho: "Kho tổng", loaiKho: "kho_tong", trangThai: 1, soLuongTon: 1396 };
const khoAo = { id: 2, maKho: "KHO_TRANSIT", tenKho: "Kho Trung Chuyển", loaiKho: "cua_hang", trangThai: 1 };
const tomTat = {
  khoId: 1, soLuongTon: 1396, soLuongKhaDung: 1352, soLuongDangGiu: 44, giaTriTon: 139600000,
  soMaHang: 39, soMaHetHang: 3, soMaSapHet: 5, nguongSapHet: 10, soNguoiPhanQuyen: 4,
};
// Intl vi-VN dùng khoảng trắng không ngắt trước "₫"
const chu = (s) => s.replace(/\u00a0/g, " ");

test("gopKhuVuc: sắp theo mã khu, bỏ vị trí bảo trì khỏi sức chứa, khu chưa có vị trí", () => {
  const khuVucs = [
    { id: 11, maKhuVuc: "B", tenKhuVuc: "Lưu trữ phụ", loaiKhu: "Lưu trữ" },
    { id: 10, maKhuVuc: "A", tenKhuVuc: "Lưu trữ chính", loaiKhu: "Lưu trữ" },
    { id: 12, maKhuVuc: "A10", tenKhuVuc: "Khu mới", loaiKhu: "Khác" },
    { id: 13, maKhuVuc: "A2", tenKhuVuc: "Đóng gói", loaiKhu: "Đóng gói" },
  ];
  const viTris = [
    { khuVucId: 10, sucChua: 100, dangChua: 78, trangThai: "HOAT_DONG" },
    { khuVucId: 10, sucChua: 100, dangChua: 50, trangThai: "BAO_TRI" },
    { khuVucId: 11, sucChua: 50, dangChua: 50, trangThai: "HOAT_DONG" },
    { khuVucId: 13, sucChua: 40, dangChua: 10, trangThai: "HOAT_DONG" },
  ];
  const { khu, tong } = gopKhuVuc(khuVucs, viTris);

  assert.deepEqual(khu.map((k) => k.ma), ["A", "A2", "A10", "B"]);
  const a = khu[0];
  assert.equal(a.soViTri, 2);
  assert.equal(a.soBaoTri, 1);
  assert.equal(a.phanTram, 78);
  assert.equal(a.tone, "warn");
  assert.equal(a.nhanMuc, "78% · Sắp đầy");
  assert.equal(khu[3].tone, "bad");
  assert.equal(khu[3].nhanMuc, "100% · Đầy");
  assert.equal(khu[1].nhanMuc, "25% đã dùng");
  assert.equal(khu[2].coThanh, false);
  assert.equal(khu[2].nhanMuc, "Chưa có vị trí");

  // Tổng: (78 + 50 + 10) / (100 + 50 + 40) = 72,6% → 72% (làm tròn xuống), sắp đầy
  assert.equal(tong.soKhu, 4);
  assert.equal(tong.soViTri, 4);
  assert.equal(tong.soBaoTri, 1);
  assert.equal(tong.phanTram, 72);
  assert.equal(tong.tone, "warn");
  assert.equal(tong.coKe, true);
  assert.equal(tomTatKe(tong), "4 khu · 4 vị trí · 1 bảo trì");
});

test("gopKhuVuc: kho chưa có khu, hoặc có khu mà chưa có vị trí", () => {
  assert.equal(gopKhuVuc([], []).tong.coKe, false);
  assert.equal(tomTatKe(gopKhuVuc([], []).tong), "");
  const chuaViTri = gopKhuVuc([{ id: 1, maKhuVuc: "A", tenKhuVuc: "A" }], []);
  assert.equal(chuaViTri.khu.length, 1);
  assert.equal(chuaViTri.tong.coKe, false);
});

test("gopKhuVuc: làm tròn xuống để số khớp màu (99,6% chưa đầy, 69,8% chưa tới ngưỡng)", () => {
  const { khu } = gopKhuVuc(
    [{ id: 1, maKhuVuc: "A", tenKhuVuc: "A" }, { id: 2, maKhuVuc: "B", tenKhuVuc: "B" }],
    [{ khuVucId: 1, sucChua: 1000, dangChua: 996 }, { khuVucId: 2, sucChua: 1000, dangChua: 698 }],
  );
  assert.equal(khu[0].nhanMuc, "99% · Sắp đầy");
  assert.equal(khu[1].nhanMuc, "69% đã dùng");
});

test("nhanMucDay", () => {
  assert.equal(nhanMucDay(70, "warn"), "70% · Sắp đầy");
  assert.equal(nhanMucDay(100, "bad"), "100% · Đầy");
  assert.equal(nhanMucDay(0, ""), "0% đã dùng");
});

test("taoOSo: kho đang hoạt động có 4 ô, mỗi ô mở đúng trang đã lọc kho", () => {
  const ke = gopKhuVuc(
    [{ id: 10, maKhuVuc: "A", tenKhuVuc: "A" }],
    [{ khuVucId: 10, sucChua: 100, dangChua: 60, trangThai: "HOAT_DONG" }],
  ).tong;
  const o = taoOSo(khoTong, tomTat, ke);

  assert.deepEqual(o.map((x) => x.khoa), ["ton", "gia-tri", "ma-hang", "suc-chua"]);
  assert.equal(o[0].giaTri, "1.396");
  assert.equal(o[0].phu[0].chu, "Khả dụng 1.352");
  assert.equal(o[0].den.to, "/reports/inventory?kho=1");
  assert.equal(chu(o[1].giaTri), "139,6 triệu ₫");
  assert.equal(chu(o[1].phu[0].chu), "139.600.000 ₫");
  assert.equal(o[1].goiY, "Tính theo giá vốn của từng lô");
  assert.equal(o[2].giaTri, "39");
  assert.deepEqual(o[2].phu, [{ chu: "3 hết hàng", tone: "bad" }, { chu: " · " }, { chu: "5 sắp hết", tone: "warn" }]);
  assert.equal(o[2].den.to, "/reports/inventory?kho=1&tinhTrang=het-hang");
  assert.equal(o[3].giaTri, "60%");
  assert.deepEqual(o[3].thanh, { phanTram: 60, tone: "" });
  assert.equal(o[3].phu[0].chu, "1 khu · 1 vị trí");
  assert.deepEqual(o[3].den, { loai: "vi-tri-ke" });
});

test("taoOSo: mã hàng chỉ sắp hết mở tab Sắp hết hàng; không mã nào thiếu; kho trống", () => {
  const chiSapHet = taoOSo(khoTong, { ...tomTat, soMaHetHang: 0, soMaSapHet: 2 }, null)[2];
  assert.deepEqual(chiSapHet.phu, [{ chu: "2 sắp hết", tone: "warn" }]);
  assert.equal(chiSapHet.den.to, "/reports/inventory?kho=1&tinhTrang=thieu-hang");

  const du = taoOSo(khoTong, { ...tomTat, soMaHetHang: 0, soMaSapHet: 0 }, null)[2];
  assert.deepEqual(du.phu, [{ chu: "Không mã nào sắp hết" }]);
  assert.equal(du.den.to, "/reports/inventory?kho=1");

  const trong = taoOSo(khoTong, { khoId: 1, soLuongTon: 0, soLuongKhaDung: 0, giaTriTon: 0, soMaHang: 0, soMaHetHang: 0, soMaSapHet: 0 }, null);
  assert.equal(trong[0].phu[0].chu, "Chưa có hàng");
  assert.equal(chu(trong[1].giaTri), "0 ₫");
  assert.equal(trong[1].phu[0].chu, "theo giá vốn");
  assert.deepEqual(trong[2].phu, [{ chu: "Chưa có hàng" }]);
});

test("taoOSo: sức chứa khi chưa có kệ và khi đang tải khu vực", () => {
  const chuaKe = taoOSo(khoTong, tomTat, gopKhuVuc([], []).tong)[3];
  assert.equal(chuaKe.giaTri, "—");
  assert.equal(chuaKe.thanh, null);
  assert.equal(chuaKe.phu[0].chu, "Chưa có vị trí kệ");

  const dangTai = taoOSo(khoTong, tomTat, null)[3];
  assert.equal(dangTai.phu[0].chu, "");
});

test("taoOSo: kho ngừng hoạt động không mở báo cáo / vị trí kệ (các trang đó không chọn được kho này)", () => {
  const o = taoOSo({ ...khoTong, trangThai: 0 }, tomTat, null);
  assert.ok(o.every((x) => !x.den));
});

test("taoOSo: kho ảo có 3 ô hàng đang chuyển, không gắn liên kết (danh sách phiếu chuyển lọc theo kho làm việc)", () => {
  const o = taoOSo(khoAo, { khoId: 2, soLuongTon: 12, giaTriTon: 1200000, soMaHang: 2 }, null);
  assert.deepEqual(o.map((x) => x.nhan), ["Đang chuyển", "Giá trị đang chuyển", "Mã hàng"]);
  assert.equal(o[0].giaTri, "12");
  assert.equal(chu(o[1].giaTri), "1,2 triệu ₫");
  assert.ok(o.every((x) => !x.den));
});

test("nhanPhanQuyen và câu hệ quả khi ngừng hoạt động", () => {
  assert.equal(nhanPhanQuyen(4), "4 người, ngoài quản lý kho");
  assert.equal(nhanPhanQuyen(0), "Chưa phân quyền thêm ai");
  assert.deepEqual(cauNgungHoatDong(khoTong).map((c) => c.loai), ["ton", "kho-tong", "giu-nguyen"]);
  assert.equal(cauNgungHoatDong(khoTong)[0].soLuong, "1.396");
  assert.deepEqual(cauNgungHoatDong({ ...khoTong, loaiKho: "cua_hang", soLuongTon: 0 }).map((c) => c.loai), ["giu-nguyen"]);
});
