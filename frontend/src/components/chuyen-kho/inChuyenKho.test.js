// Chạy: node --test src/components/chuyen-kho/inChuyenKho.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chuLech,
  dauCongTy,
  dongBienBan,
  dongDieuChinh,
  dongHangXknb,
  dongHangYeuCau,
  lyDoChuaIn,
  ngayChu,
  ngayDu,
  phuongTienIn,
  soIn,
  tenLyDoDieuDong,
  tenPhuongAn,
  tienIn,
  trangThaiDieuChinh,
  veViec,
} from "./inChuyenKho.js";

const LY_DO = [
  { ma: "BO_SUNG", nhan: "Bổ sung hàng bán" },
  { ma: "KHAC", nhan: "Khác" },
];

test("số lượng bỏ số 0 thừa của DECIMAL, tiền làm tròn tới đồng, trống giữ trống", () => {
  assert.equal(soIn("12.000"), "12");
  assert.equal(soIn(1234), "1.234");
  assert.equal(soIn(null), "");
  assert.equal(tienIn("125000.40"), "125.000");
  assert.equal(tienIn(undefined), "");
});

test("ngày LocalDate đọc theo giờ máy (không lệch ngày), thiếu ngày để chấm điền tay", () => {
  assert.equal(ngayDu("2026-10-05"), "05/10/2026");
  assert.equal(ngayChu("2026-10-05"), "Ngày 05 tháng 10 năm 2026");
  assert.equal(ngayChu(null), "Ngày …… tháng …… năm ……");
  assert.equal(ngayDu("không phải ngày"), "……");
});

test("giấy chưa áp dụng: lệnh và XKNB cần duyệt, biên bản cần nhận lệch, loại lạ bị từ chối", () => {
  const choDuyet = { trangThai: "CHO_DUYET" };
  assert.equal(lyDoChuaIn("yeu-cau", choDuyet), null);
  assert.match(lyDoChuaIn("lenh-dieu-dong", choDuyet), /sau khi Quản lý Kho tổng duyệt/);
  assert.match(lyDoChuaIn("xknb", { trangThai: "DA_HUY" }), /hủy trước khi được duyệt/);
  assert.equal(lyDoChuaIn("xknb", { trangThai: "DANG_VAN_CHUYEN", soLenhDieuDong: "LDD-20261028-001" }), null);
  assert.match(lyDoChuaIn("bien-ban", { soLenhDieuDong: "LDD-1" }), /chưa có biên bản/);
  assert.match(lyDoChuaIn("hoa-don", choDuyet), /Không có mẫu in/);
});

test("lý do điều động: Khác lấy ghi chú lệnh, không lặp ghi chú ở Về việc", () => {
  assert.equal(tenLyDoDieuDong("BO_SUNG", "x", LY_DO), "Bổ sung hàng bán");
  assert.equal(tenLyDoDieuDong("KHAC", "Mở cửa hàng mới", LY_DO), "Mở cửa hàng mới");
  assert.equal(veViec({ lyDoDieuDong: "BO_SUNG", ghiChuLenh: "Gấp trước 20/11" }, LY_DO), "bổ sung hàng bán. Gấp trước 20/11");
  assert.equal(veViec({ lyDoDieuDong: "KHAC", ghiChuLenh: "Mở cửa hàng mới" }, LY_DO), "Mở cửa hàng mới");
  assert.equal(tenPhuongAn("GHI_GIAM_HAO_HUT"), "Ghi giảm hao hụt / Đền bù");
});

test("bảng XKNB: đã xuất theo lô có giá vốn; chưa xuất theo biến thể, chưa có đơn giá", () => {
  const daXuat = dongHangXknb({
    hang: [{ bienTheId: 1, donViTinh: "Chiếc", soLuongChuyen: 5 }],
    hangTheoLo: [
      { bienTheId: 1, loHangId: 7, tenSanPham: "Áo", tenMau: "Đen", kichCo: "M", sku: "A-M", maLo: "LO-1", soLuong: "3.000", giaVon: "100000.00" },
      { bienTheId: 1, loHangId: 8, tenSanPham: "Áo", tenMau: "Đen", kichCo: "M", sku: "A-M", maLo: "LO-2", soLuong: 2, giaVon: 120000 },
    ],
  });
  assert.equal(daXuat.theoLo, true);
  assert.equal(daXuat.dong[0].ten, "Áo – Đen / M");
  assert.equal(daXuat.dong[0].dvt, "Chiếc", "dòng theo lô lấy đơn vị tính của biến thể");
  assert.equal(daXuat.tongSoLuong, 5);
  assert.equal(daXuat.tongTien, 540000);

  const chuaXuat = dongHangXknb({ hangTheoLo: [], hang: [{ bienTheId: 2, tenSanPham: "Quần", sku: "Q-1", soLuongChuyen: 4 }] });
  assert.equal(chuaXuat.theoLo, false);
  assert.equal(chuaXuat.tongTien, null);
  assert.equal(chuaXuat.dong[0].donGia, null);
  assert.equal(chuaXuat.dong[0].dvt, "Cái", "chưa khai báo đơn vị tính thì in Cái");
  assert.equal(dongHangYeuCau({ hang: [{ bienTheId: 2, soLuongChuyen: 4 }, { bienTheId: 3, soLuongChuyen: 6 }] }).tongSoLuong, 10);
});

test("phương tiện: chuyển phát ghi đơn vị + vận đơn, thuê ngoài ghi số hợp đồng, chưa xuất để trống", () => {
  assert.deepEqual(phuongTienIn({}), { phuongTien: "", hopDong: "—" });
  assert.deepEqual(phuongTienIn({ hinhThucVanChuyen: "CHUYEN_PHAT", donViVanChuyen: "GHN", maVanDonHopDong: "VD1" }),
    { phuongTien: "GHN – mã vận đơn VD1", hopDong: "—" });
  assert.deepEqual(phuongTienIn({ hinhThucVanChuyen: "THUE_NGOAI", loaiPhuongTien: "Xe tải 1,5 tấn", bienSoXe: "29C-12345", maVanDonHopDong: "HD-09" }),
    { phuongTien: "Xe tải 1,5 tấn – biển số 29C-12345", hopDong: "HD-09" });
});

test("biên bản: chỉ in dòng lệch, tổng lấy theo biên bản đã lưu", () => {
  const { dong, tong } = dongBienBan({
    tongGui: 10, tongNhan: 7, tongHong: 1, tongThieu: 2,
    dong: [
      { id: 1, sku: "A", gui: 5, nhan: 5, hong: 0, thieu: 0 },
      { id: 2, sku: "B", gui: 5, nhan: 2, hong: 1, thieu: 2, lyDo: "Rách bao" },
    ],
  });
  assert.equal(dong.length, 1);
  assert.equal(dong[0].sku, "B");
  assert.deepEqual(tong, { gui: 10, dat: 7, hong: 1, thieu: 2 });
});

test("phiếu điều chỉnh: số giảm dương, tổng tiền theo phiếu, chữ lệch, nhãn trạng thái", () => {
  const { dong, tongSoLuong, tongTien } = dongDieuChinh({
    tongGiaTriGiam: "-300000.00",
    dong: [{ bienTheId: 1, sku: "A", maLo: "LO-1", soLuong: "-3.000", giaVon: 100000, thanhTien: -300000, thieu: 2, hong: 1 }],
  });
  assert.equal(dong[0].soLuong, 3);
  assert.equal(dong[0].thanhTien, 300000);
  assert.equal(tongSoLuong, 3);
  assert.equal(tongTien, 300000);
  assert.equal(chuLech(dong[0]), "Thiếu 2 · Hỏng 1");
  assert.deepEqual(trangThaiDieuChinh(2), { label: "Đã áp dụng", nhom: "xong" });
  assert.equal(dongDieuChinh({ dong: [{ soLuong: -1, giaVon: null, thanhTien: null }] }).tongTien, null, "thiếu giá vốn thì không in tổng 0");
});

test("đầu giấy: tên đăng ký viết hoa, hồ sơ trống để chấm điền tay", () => {
  assert.equal(dauCongTy({ legalName: "Công ty TNHH Thời trang F", taxCode: "0109" }).ten, "CÔNG TY TNHH THỜI TRANG F");
  assert.match(dauCongTy({}).maSoThue, /^…+$/);
});
