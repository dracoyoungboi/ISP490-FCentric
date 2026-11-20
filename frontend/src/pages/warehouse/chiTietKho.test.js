import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cauKhongCoNhanVien, cauNgungHoatDong, dsNhanVienKho, gopKhuVuc, locNhanVien, nhanConLai, nhanMucDay, nhanNguoiQuanLy,
  soQuanLyKho, taoOSo, tomTatKe,
  tomTatQuanLyKho, tomTatVaiTro,
} from "./chiTietKho.js";

test("tomTatQuanLyKho: người quản lý chính và các quản lý kho khác cùng kho", () => {
  const an = { id: 1, hoTen: "An" };
  const binh = { id: 2, hoTen: "Bình" };
  const chi = { id: 3, hoTen: "", tenDangNhap: "chi" };
  assert.deepEqual(tomTatQuanLyKho({ quanLy: an, quanLyKhac: [binh, chi] }),
    { chinh: "An", khac: ["Bình", "chi"], moTaKhac: "Cùng quản lý: Bình, chi" });
  assert.deepEqual(tomTatQuanLyKho({ quanLy: null, quanLyKhac: [binh] }),
    { chinh: "", khac: ["Bình"], moTaKhac: "Quản lý kho tại kho: Bình" }, "chưa ai đứng tên");
  assert.deepEqual(tomTatQuanLyKho({ quanLy: an }), { chinh: "An", khac: [], moTaKhac: "" }, "API khác không trả quanLyKhac");
  assert.deepEqual(tomTatQuanLyKho(null), { chinh: "", khac: [], moTaKhac: "" });
});

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

test("dsNhanVienKho: giữ cả quản lý kho cùng làm ở kho, giữ thứ tự máy chủ, nhãn vai trò", () => {
  const nhanVien = [
    { id: 2, hoTen: "Bình", tenDangNhap: "binh", vaiTro: "quan_ly_kho", avatarUrl: null },
    { id: 5, hoTen: "  ", tenDangNhap: "lan", vaiTro: "nhan_vien_kho", avatarUrl: "https://anh/5.png" },
    { id: 6, hoTen: "Dũng", tenDangNhap: "dung", vaiTro: "nhan_vien_ban_hang" },
    null,
    { id: 7, hoTen: "Hà", tenDangNhap: "ha", vaiTro: "vai_tro_la" },
  ];
  assert.deepEqual(dsNhanVienKho(nhanVien), [
    { id: 2, ten: "Bình", maVaiTro: "quan_ly_kho", vaiTro: "Quản lý kho", avatarUrl: null },
    { id: 5, ten: "lan", maVaiTro: "nhan_vien_kho", vaiTro: "Nhân viên kho", avatarUrl: "https://anh/5.png" },
    { id: 6, ten: "Dũng", maVaiTro: "nhan_vien_ban_hang", vaiTro: "Nhân viên bán hàng", avatarUrl: null },
    { id: 7, ten: "Hà", maVaiTro: "vai_tro_la", vaiTro: "", avatarUrl: null },
  ]);
  assert.deepEqual(dsNhanVienKho(undefined), []);
});

test("tomTatVaiTro: đếm theo vai trò, giữ thứ tự, vai trò lạ gộp vào người khác", () => {
  const ds = [
    { maVaiTro: "nhan_vien_kho" }, { maVaiTro: "nhan_vien_ban_hang" },
    { maVaiTro: "nhan_vien_mua_hang" }, { maVaiTro: "nhan_vien_mua_hang" }, { maVaiTro: "nhan_vien_mua_hang" },
  ];
  assert.equal(tomTatVaiTro(ds), "1 nhân viên kho · 1 bán hàng · 3 mua hàng");
  assert.equal(tomTatVaiTro([{ maVaiTro: "quan_ly_kho" }, { maVaiTro: "ke_toan" }]), "1 quản lý kho · 1 người khác");
  assert.equal(tomTatVaiTro([]), "");
});

test("cauKhongCoNhanVien và câu hệ quả khi ngừng hoạt động", () => {
  assert.equal(cauKhongCoNhanVien(true), "Chưa có nhân viên nào khác");
  assert.equal(cauKhongCoNhanVien(false), "Chưa có nhân viên nào");
  assert.deepEqual(cauNgungHoatDong(khoTong).map((c) => c.loai), ["ton", "kho-tong", "giu-nguyen"]);
  assert.equal(cauNgungHoatDong(khoTong)[0].soLuong, "1.396");
  assert.deepEqual(cauNgungHoatDong({ ...khoTong, loaiKho: "cua_hang", soLuongTon: 0 }).map((c) => c.loai), ["giu-nguyen"]);
});

test("nhanConLai và locNhanVien: ô +N quá 99 ghi 99+, tìm không dấu theo tên hoặc vai trò", () => {
  assert.equal(nhanConLai(12), "+12");
  assert.equal(nhanConLai(99), "+99");
  assert.equal(nhanConLai(146), "99+");
  const ds = [
    { id: 1, ten: "Đặng Thị Lan", vaiTro: "Nhân viên bán hàng" },
    { id: 2, ten: "Nguyễn Văn An", vaiTro: "Nhân viên kho" },
    { id: 3, ten: "lan.kho", vaiTro: "Nhân viên mua hàng" },
  ];
  assert.deepEqual(locNhanVien(ds, "dang").map((x) => x.id), [1]);
  assert.deepEqual(locNhanVien(ds, " LAN ").map((x) => x.id), [1, 3]);
  assert.deepEqual(locNhanVien(ds, "mua hang").map((x) => x.id), [3]);
  assert.equal(locNhanVien(ds, "").length, 3);
  assert.deepEqual(locNhanVien(ds, "zzz"), []);
});

test("soQuanLyKho và nhanNguoiQuanLy: từ 2 quản lý kho mới ghi người quản lý chính", () => {
  const an = { id: 1, hoTen: "An" };
  const ds = [{ id: 2, maVaiTro: "quan_ly_kho" }, { id: 3, maVaiTro: "nhan_vien_kho" }];
  assert.equal(soQuanLyKho({ quanLy: an }, ds), 2);
  assert.equal(soQuanLyKho({ quanLy: an }, [{ id: 3, maVaiTro: "nhan_vien_kho" }]), 1);
  assert.equal(soQuanLyKho({ quanLy: null }, ds), 1, "chưa ai đứng tên");
  assert.equal(soQuanLyKho({ quanLy: an, quanLyKhac: [{ id: 2 }, { id: 4 }] }, null), 3, "không có danh sách thì dùng quanLyKhac");
  assert.equal(soQuanLyKho(null, null), 0);
  assert.equal(nhanNguoiQuanLy(2), "Người quản lý chính");
  assert.equal(nhanNguoiQuanLy(1), "Người quản lý");
  assert.equal(nhanNguoiQuanLy(0), "Người quản lý");
});
