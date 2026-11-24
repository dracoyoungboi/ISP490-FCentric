// Chạy: node --test src/components/ban-hang/chi-tiet-don-ban/tinhDonBan.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buocDonBan,
  coTheMoHopGuiSangKho,
  dongHangBan,
  duongDanChuyenKhoBu,
  ghiChuKhiXuat,
  gioNgay,
  hauQuaHuy,
  laDonBaSan,
  laDonSan,
  laDonTaiQuay,
  laDonTikTok,
  laGhiChuTuSinh,
  laGiaTriAnPii,
  laMaVanDonGiaShopee,
  lamSachGhiChuDonSan,
  lyDoKhoaHuy,
  lyDoSanHuy,
  nenMoHopGuiKhoThuCongKhiLoi,
  phieuDaXuatCuoi,
  tachTenDong,
  thanhToanDonBan,
  thaoTacDonBan,
  thieuTonDonBan,
  thongBaoDonBan,
  tienDonBan,
} from "./tinhDonBan.js";

const don = (extra = {}) => ({
  id: 217,
  soDonHang: "SO202610217",
  loaiChungTu: "don_ban_hang",
  trangThai: 0,
  khoXuat: { id: 1, tenKho: "Kho tổng", maKho: "KHO-TONG" },
  tienHang: 1000000,
  phiVanChuyen: 30000,
  tongCong: 1030000,
  ngayTao: "2026-10-21T02:12:00Z",
  ...extra,
});
const ct = (donExtra = {}, extra = {}) => ({
  donBanHang: don(donExtra),
  chiTiet: [],
  phieuXuatKhoList: [],
  phieuNhatHangId: null,
  maPickList: null,
  trangThaiPhieuNhat: null,
  thanhToanTaiQuay: null,
  ...extra,
});
const shopify = { soDonHang: "SHP-1021", kenhBanHang: { id: 1, maKenh: "SHOPIFY", tenKenh: "Shopify" }, maDonHangKenh: "6281937465121", nguoiTao: null };

test("tachTenDong: tách từ phải, giữ ' / ' trong tên sản phẩm", () => {
  assert.deepEqual(tachTenDong("Áo Thun / Đen / L"), { tenSanPham: "Áo Thun", tenMau: "Đen", kichCo: "L" });
  assert.deepEqual(tachTenDong("Áo 2 / 1 / Đen / L"), { tenSanPham: "Áo 2 / 1", tenMau: "Đen", kichCo: "L" });
  assert.deepEqual(tachTenDong("Thắt lưng / Nâu"), { tenSanPham: "Thắt lưng", tenMau: "Nâu", kichCo: "" });
  assert.deepEqual(tachTenDong("Túi Tote"), { tenSanPham: "Túi Tote", tenMau: "", kichCo: "" });
  assert.deepEqual(tachTenDong(null), { tenSanPham: "", tenMau: "", kichCo: "" });
});

test("dongHangBan: dùng thành tiền của máy chủ, nhãn biến thể", () => {
  const ds = dongHangBan([
    { id: 1, sku: "A-L", tenSanPham: "Áo / Đen / L", soLuongDat: "2.00", donGia: "100000.00", thanhTien: "190000.00" },
    { id: 2, sku: "T-U", tenSanPham: "Túi", soLuongDat: 1, donGia: 50000, thanhTien: null },
  ]);
  assert.equal(ds[0].thanhTien, 190000);
  assert.equal(ds[0].nhanBienThe, "Đen / L");
  assert.equal(ds[1].thanhTien, 50000);
  assert.equal(ds[1].nhanBienThe, "Không có màu, kích cỡ");
});

test("loại đơn: tại quầy theo thanhToanTaiQuay, sàn theo kênh hoặc mã sàn", () => {
  assert.equal(laDonTaiQuay(ct({}, { thanhToanTaiQuay: { phuongThuc: "CASH" } })), true);
  assert.equal(laDonTaiQuay(ct()), false);
  assert.equal(laDonSan(don(shopify)), true);
  assert.equal(laDonSan(don({ maDonHangKenh: "  " })), false);
  assert.equal(laDonSan(don({ maDonHangKenh: "123" })), true);
});

test("lyDoSanHuy, ghi chú tự sinh", () => {
  assert.deepEqual(lyDoSanHuy("Hủy từ sàn Shopify: customer"), { tenSan: "Shopify", ma: "customer", chu: "khách hủy" });
  assert.equal(lyDoSanHuy("Hủy từ sàn Shopify: FRAUD").chu, "nghi gian lận");
  assert.equal(lyDoSanHuy("Hủy từ sàn Shopify: ").chu, "lý do khác");
  assert.equal(lyDoSanHuy("Khách đổi ý"), null);
  assert.equal(laGhiChuTuSinh("Đơn hàng đồng bộ tự động từ Shopify #1021"), true);
  assert.equal(laGhiChuTuSinh("Giao giờ hành chính"), false);
});

test("lyDoKhoaHuy theo đúng thứ tự backend", () => {
  assert.equal(lyDoKhoaHuy(ct({ trangThai: 0 })), "");
  assert.equal(lyDoKhoaHuy(ct({ trangThai: 1 })), "");
  // Đã xuất một phần: có phiếu đã xuất → câu phiếu xuất hoàn thành (trước câu phiếu nhặt)
  assert.equal(
    lyDoKhoaHuy(ct({ trangThai: 2 }, { maPickList: "PL-1", trangThaiPhieuNhat: "da_nhat", phieuXuatKhoList: [{ id: 9, trangThai: 3 }] })),
    "Đơn đã có phiếu xuất hoàn thành, không thể hủy",
  );
  assert.equal(
    lyDoKhoaHuy(ct({ trangThai: 1 }, { maPickList: "PL-20261021-003", trangThaiPhieuNhat: "dang_nhat" })),
    "Đơn đang nằm trong phiếu nhặt hàng PL-20261021-003 nên không thể hủy.",
  );
  assert.equal(
    lyDoKhoaHuy(ct({ trangThai: 7 }, { maPickList: "PL-1", trangThaiPhieuNhat: "da_nhat" })),
    "Đơn đang nằm trong phiếu nhặt hàng PL-1 nên không thể hủy.",
  );
  // Phiếu nhặt đã hủy không khóa; đơn 7 phiếu tạo tay thì câu khâu chờ đóng gói
  assert.equal(lyDoKhoaHuy(ct({ trangThai: 1 }, { maPickList: "PL-1", trangThaiPhieuNhat: "da_huy" })), "");
  assert.match(lyDoKhoaHuy(ct({ trangThai: 7 })), /khâu chờ đóng gói/);
  assert.match(lyDoKhoaHuy(ct({ trangThai: 8 })), /khâu chờ xuất kho/);
});

test("thaoTacDonBan: nút theo vai trò × trạng thái", () => {
  const ban = { laBan: true, laKho: false };
  const kho = { laBan: false, laKho: true };
  assert.equal(thaoTacDonBan(ct({ trangThai: 0 }), ban).nutGuiKho, true);
  assert.equal(thaoTacDonBan(ct({ trangThai: 0 }), kho).nutGuiKho, false);
  assert.equal(thaoTacDonBan(ct({ trangThai: 0 }), ban).menuHuy, true);
  // Q10: ẩn In hóa đơn khi Đã hủy
  assert.equal(thaoTacDonBan(ct({ trangThai: 4 }), ban).coIn, false);
  assert.equal(thaoTacDonBan(ct({ trangThai: 5 }), ban).coIn, true);
  assert.equal(thaoTacDonBan(ct({ trangThai: 3 }), ban).nutDaGiao, true);
  assert.equal(thaoTacDonBan(ct({ trangThai: 3 }), ban).menuHoanTra, true);
  assert.equal(thaoTacDonBan(ct({ trangThai: 2 }), ban).menuHoanTra, true);
  assert.equal(thaoTacDonBan(ct({ trangThai: 3 }), ban).menuHuy, false);
  assert.equal(thaoTacDonBan(ct({ trangThai: 7 }), kho).nutDongGoi, true);
  assert.equal(thaoTacDonBan(ct({ trangThai: 8 }, { phieuXuatKhoList: [{ id: 5, trangThai: 6 }] }), kho).nutXuat, true);
  assert.equal(thaoTacDonBan(ct({ trangThai: 8 }), kho).nutXuat, false);
  const taoLai = ct({ trangThai: 1 }, { maPickList: "PL-1", trangThaiPhieuNhat: "da_nhat", phieuXuatKhoList: [{ id: 5, trangThai: 4 }] });
  assert.equal(thaoTacDonBan(taoLai, kho).nutTaoLai, true);
  assert.equal(thaoTacDonBan(taoLai, ban).nutTaoLai, false);
  // Còn phiếu xuất mở thì không tạo lại
  const conMo = ct({ trangThai: 2 }, { trangThaiPhieuNhat: "da_nhat", phieuXuatKhoList: [{ id: 6, trangThai: 0 }] });
  assert.equal(thaoTacDonBan(conMo, kho).nutTaoLai, false);
  // Đơn tại quầy không có hủy
  assert.equal(thaoTacDonBan(ct({ trangThai: 5 }, { thanhToanTaiQuay: { phuongThuc: "CASH" } }), ban).menuHuy, false);
  // Đơn Shopify: giữ nghiệp vụ cũ, bán hàng vẫn thao tác như đơn thường; Quản lý Kho Tổng chỉ thấy nutGuiKho với đơn Shopify Nháp
  assert.equal(thaoTacDonBan(ct({ ...shopify, trangThai: 0 }), ban).nutGuiKho, true);
  const qlkTong = { laBan: false, laKho: true, laQuanLyKhoTong: true };
  const qlkChiNhanh = { laBan: false, laKho: true, laQuanLyKhoTong: false };
  assert.equal(thaoTacDonBan(ct({ ...shopify, trangThai: 0 }), qlkTong).nutGuiKho, true);
  assert.equal(thaoTacDonBan(ct({ ...shopify, trangThai: 0 }), qlkChiNhanh).nutGuiKho, false);
  assert.equal(thaoTacDonBan(ct({ trangThai: 0 }), qlkTong).nutGuiKho, false);
  assert.equal(thaoTacDonBan(ct({ kenhBanHang: { maKenh: "SHOPEE" }, maDonHangKenh: "SP-1", trangThai: 0 }), qlkTong).nutGuiKho, false);
});

test("buocDonBan: tại quầy không có; hủy không suy được thì ẩn; sàn hủy đặt bước dừng", () => {
  assert.deepEqual(buocDonBan(ct({ trangThai: 5 }, { thanhToanTaiQuay: { phuongThuc: "CASH" } })), []);
  assert.deepEqual(buocDonBan(ct({ trangThai: 4 })), []);
  const nhap = buocDonBan(ct({ trangThai: 0 }));
  assert.equal(nhap.length, 6);
  assert.deepEqual(nhap.map((b) => b.trangThai), ["xong", "dangLam", "chua", "chua", "chua", "chua"]);
  assert.equal(nhap[0].ngay, "2026-10-21T02:12:00Z");
  const sanDongGoi = buocDonBan(ct({ ...shopify, trangThai: 4, lyDoTuChoi: "Hủy từ sàn Shopify: customer" }, { maPickList: "PL-1", phieuXuatKhoList: [{ id: 3, trangThai: 4 }] }));
  assert.deepEqual(sanDongGoi.map((b) => b.trangThai), ["xong", "xong", "xong", "dung", "chua", "chua"]);
  assert.equal(sanDongGoi[3].nhan, "Đã hủy");
  assert.equal(sanDongGoi[3].phu, "Shopify hủy đơn");
  const sanNhat = buocDonBan(ct({ ...shopify, trangThai: 4, lyDoTuChoi: "Hủy từ sàn Shopify: other" }, { maPickList: "PL-1" }));
  assert.equal(sanNhat[2].trangThai, "dung");
  const hoanTra = buocDonBan(ct({ trangThai: 6 }));
  assert.equal(hoanTra[5].nhan, "Bị hoàn trả");
  assert.equal(hoanTra[4].trangThai, "xong");
  const motPhan = buocDonBan(ct({ trangThai: 2 }));
  assert.equal(motPhan[4].phu, "Còn phần chưa xuất");
  const daXuat = buocDonBan(ct({ trangThai: 3 }, { phieuXuatKhoList: [{ id: 1, trangThai: 3, ngayXuat: "2026-10-21T07:05:00Z" }] }));
  assert.equal(daXuat[4].ngay, "2026-10-21T07:05:00Z");
  assert.equal(buocDonBan(ct({ trangThai: 5 }))[5].phu, "Khách đã nhận");
  assert.deepEqual(buocDonBan(ct({ trangThai: 99 })), []);
});

test("thongBaoDonBan: câu theo vai trò", () => {
  const nhapBan = thongBaoDonBan(ct({ trangThai: 0 }), { laBan: true });
  assert.match(nhapBan[0].chu, /đã trừ vào tồn có thể bán của Kho tổng, chưa giữ lô/);
  assert.equal(thongBaoDonBan(ct({ trangThai: 0 }), { laKho: true })[0].chu, "Đơn nháp, bán hàng chưa gửi sang kho.");
  assert.match(thongBaoDonBan(ct({ ...shopify, trangThai: 0 }), { laBan: true })[0].chu, /^Đơn Shopify tự về Kho tổng\./);
  const tbShopifyDaKho = thongBaoDonBan(
    ct({ ...shopify, trangThai: 0 }, { khoDeXuatId: 2, tenKhoDeXuat: "Kho Chi Nhánh HCM", phuongThucGiaoSan: "PICK_UP", tachNhieuKhoSan: true }),
    { laBan: true, laKho: true, laQuanLyKhoTong: true }
  );
  assert.match(tbShopifyDaKho[0].chu, /^Đơn Shopify tự về Kho tổng\./);
  assert.ok(tbShopifyDaKho.length >= 2, `Cần nối thêm gợi ý kho/PICK_UP/tách kho sau item[0], nhận được: ${JSON.stringify(tbShopifyDaKho)}`);
  const gop = tbShopifyDaKho.map((x) => x.chu).join(" | ");
  assert.match(gop, /Kho Chi Nhánh HCM/);
  const choGom = thongBaoDonBan(ct({ trangThai: 1 }), { laKho: true })[0];
  assert.equal(choGom.lienKet, "donChoXuat");
  assert.equal(thongBaoDonBan(ct({ trangThai: 1 }), { laBan: true })[0].lienKet, null);
  const pxHuy = ct({ trangThai: 1 }, { maPickList: "PL-1", trangThaiPhieuNhat: "da_nhat", phieuXuatKhoList: [{ id: 4, soPhieuXuat: "PX9", trangThai: 4 }] });
  assert.match(thongBaoDonBan(pxHuy, { laKho: true })[0].chu, /^Phiếu xuất PX9 đã bị hủy sau khi nhặt xong\. Tạo lại/);
  assert.match(thongBaoDonBan(pxHuy, { laBan: true })[0].chu, /Kho cần tạo lại phiếu xuất/);
  const sanHuy = ct({ ...shopify, trangThai: 4, lyDoTuChoi: "Hủy từ sàn Shopify: inventory" }, { maPickList: "PL-2", trangThaiPhieuNhat: "da_nhat", phieuXuatKhoList: [{ id: 7, soPhieuXuat: "PX7", trangThai: 4 }] });
  const tbKho = thongBaoDonBan(sanHuy, { laKho: true });
  assert.equal(tbKho[0].chu, "Shopify đã hủy đơn, lý do: hết hàng. Phiếu xuất PX7 đã được thu hồi.");
  assert.match(tbKho[1].chu, /khu hoàn kệ theo phiếu nhặt PL-2/);
  assert.equal(thongBaoDonBan(sanHuy, { laBan: true }).length, 1);
  assert.match(thongBaoDonBan(ct({ trangThai: 4 }), {})[0].chu, /^Đơn đã hủy\./);
  assert.match(thongBaoDonBan(ct({ trangThai: 6 }), {})[0].chu, /Hàng chưa vào lại tồn kho/);
  assert.match(thongBaoDonBan(ct({ trangThai: 5 }, { thanhToanTaiQuay: {} }), {})[0].chu, /Đã thu tiền và trừ tồn ở Kho tổng/);
  assert.deepEqual(thongBaoDonBan(ct({ trangThai: 3 }), { laBan: true }), []);
});

test("tienDonBan: không tự cộng, báo lệch", () => {
  const t = tienDonBan(don({ tienHang: 1000000, phiVanChuyen: 32000, tongCong: 1030000 }), [{ thanhTien: 1000000 }]);
  assert.equal(t.lechTong, true);
  assert.equal(t.tongCong, 1030000);
  assert.equal(t.lechDong, false);
  const san = tienDonBan(don({ tienHang: 900000 }), [{ thanhTien: 1000000 }], { laSan: true });
  assert.equal(san.lechDong, true);
  assert.equal(san.chenhDong, 100000);
});

test("hauQuaHuy và thanh toán", () => {
  assert.deepEqual(hauQuaHuy(ct()), ["Trả số hàng của đơn về tồn có thể bán của Kho tổng."]);
  const san = hauQuaHuy(ct({ ...shopify, trangThaiThanhToan: "da_thanh_toan" }));
  assert.equal(san.length, 3);
  assert.match(san[2], /Không tự hoàn tiền/);
  // Đơn bán thường cũ: trạng thái lưu trên đơn, trống là chưa theo dõi (kèm câu trung tính)
  assert.deepEqual(thanhToanDonBan(ct()), { maTrangThai: null, chu: "Hệ thống không theo dõi thanh toán của đơn này." });
  assert.deepEqual(thanhToanDonBan(ct({ trangThaiThanhToan: "da_thanh_toan" })), { maTrangThai: "da_thanh_toan", chu: null });
  assert.equal(thanhToanDonBan(ct(shopify)).maTrangThai, "chua_thanh_toan");
  const pos = thanhToanDonBan(ct({}, { thanhToanTaiQuay: { phuongThuc: "PAYOS", ngayThu: "x" } }));
  assert.equal(pos.phuongThuc, "Chuyển khoản qua PayOS");
  assert.equal(pos.laTienMat, false);
  assert.equal(thanhToanDonBan(ct({}, { thanhToanTaiQuay: { phuongThuc: "CASH" } })).laTienMat, true);
});

test("phieuDaXuatCuoi: theo ngày xuất", () => {
  const p = phieuDaXuatCuoi(ct({}, { phieuXuatKhoList: [
    { id: 1, trangThai: 3, ngayXuat: "2026-10-21T05:00:00Z" },
    { id: 2, trangThai: 4 },
    { id: 3, trangThai: 3, ngayXuat: "2026-10-20T05:00:00Z" },
  ] }));
  assert.equal(p.id, 1);
});

test("ghiChuKhiXuat bỏ câu hệ thống, giữ ghi chú của kho; gioNgay", () => {
  assert.equal(ghiChuKhiXuat("Phiếu xuất tự động từ đợt nhặt hàng PL-20261021-002\ngiao giờ HC"), "giao giờ HC");
  assert.equal(ghiChuKhiXuat("Phiếu xuất tự động từ đợt nhặt hàng PL-1 - giao trước 7h"), "giao trước 7h");
  assert.equal(ghiChuKhiXuat("Tạo lại sau khi phiếu xuất trước bị hủy"), null);
  assert.equal(ghiChuKhiXuat("Giao kèm hóa đơn VAT"), "Giao kèm hóa đơn VAT");
  assert.equal(ghiChuKhiXuat(null), null);
  assert.equal(gioNgay("2026-10-17T16:21:00"), "16:21 · 17/10");
  assert.equal(gioNgay(null), "");
});

test("lyDoKhoaHuy: phiếu nhặt theo id, phiếu xuất chỉ mã 3; hoàn kệ khi phiếu nhặt đã hủy", () => {
  assert.match(lyDoKhoaHuy(ct({ trangThai: 1 }, { phieuNhatHangId: 5, trangThaiPhieuNhat: "cho_nhat" })), /^Đơn đang nằm trong phiếu nhặt hàng nên không thể hủy\.$/);
  assert.equal(lyDoKhoaHuy(ct({ trangThai: 1 }, { phieuXuatKhoList: [{ id: 1, trangThai: 5 }] })), "");
  const sanHuy = ct({ ...shopify, trangThai: 4, lyDoTuChoi: "Hủy từ sàn Shopify: customer" }, { maPickList: "PL-3", trangThaiPhieuNhat: "da_huy" });
  assert.equal(thongBaoDonBan(sanHuy, { laKho: true }).length, 2);
});

test("dongHangBan: máy chủ mới trả tên gốc, màu, mã màu, cỡ, ảnh, id sản phẩm", () => {
  const [d] = dongHangBan([{ id: 1, sanPhamId: 7, tenSanPham: "Áo Polo / Trắng / M", tenSanPhamGoc: "Áo Polo", tenMau: "Trắng", maMauHex: "#ffffff", kichCo: "M", anh: "p.jpg", sku: "AP-M", soLuongDat: 2, donGia: 100 }]);
  assert.equal(d.khoaNhom, 7);
  assert.equal(d.tenSanPham, "Áo Polo");
  assert.equal(d.tenMau, "Trắng");
  assert.equal(d.maMauHex, "#ffffff");
  assert.equal(d.kichCo, "M");
  assert.equal(d.anh, "p.jpg");
  assert.equal(d.nhanBienThe, "Trắng / M");
  // Tên sản phẩm có " / " vẫn đúng vì dùng tên gốc, không tách chuỗi
  const [c] = dongHangBan([{ id: 2, tenSanPham: "Quần A / B / Đen / L", tenSanPhamGoc: "Quần A / B", tenMau: "Đen", kichCo: "L", soLuongDat: 1, donGia: 1 }]);
  assert.equal(c.tenSanPham, "Quần A / B");
  // Máy chủ cũ: tách chuỗi như trước, không có mã màu / ảnh
  const [cu] = dongHangBan([{ id: 3, tenSanPham: "Áo Polo / Trắng / M", soLuongDat: 1, donGia: 1 }]);
  assert.equal(cu.tenSanPham, "Áo Polo");
  assert.equal(cu.kichCo, "M");
  assert.equal(cu.maMauHex, "");
  assert.equal(cu.anh, null);
  assert.equal(cu.khoaNhom, null);
});

test("Shopee UNPAID Chờ xác nhận: chỉ cho xem, khóa Gửi sang kho & Hủy đơn, hiện thông báo nhắc", () => {
  const ban = { laBan: true, laKho: false };
  const shopee = { kenhBanHang: { maKenh: "SHOPEE_OFFICIAL", tenKenh: "Shopee" }, maDonHangKenh: "261120TEST" };
  const unpaidCt = ct(
    { ...shopee, trangThai: 0, ghiChu: "Đơn hàng đồng bộ tự động từ Shopee #261120TEST [SHOPEE_CHO_XAC_NHAN]" },
    { choXacNhanSan: true, coTheGuiSangKho: false },
  );
  const vUnpaid = thaoTacDonBan(unpaidCt, ban);
  assert.equal(vUnpaid.nutGuiKho, false);
  assert.equal(vUnpaid.menuHuy, false);
  const tb = thongBaoDonBan(unpaidCt, ban);
  assert.equal(tb[0].ma, "choXacNhanSan");
  assert.match(tb[0].chu, /Chờ xác nhận nên chỉ xem được/);

  const readyCt = ct({ ...shopify, ...shopee, kenhBanHang: { maKenh: "SHOPEE_OFFICIAL", tenKenh: "Shopee" }, trangThai: 0, ghiChu: "Đơn hàng đồng bộ tự động từ Shopee #261120TEST" });
  assert.equal(thaoTacDonBan(readyCt, ban).nutGuiKho, true);
  assert.equal(thaoTacDonBan(readyCt, ban).menuHuy, true);
});

test("lamSachGhiChuDonSan, laGiaTriAnPii, laMaVanDonGiaShopee: dọn sạch thẻ nội bộ & ẩn nút sao chép PII", () => {
  const ghiChuLoiThucTe = "[VẬN ĐƠN: SPXVN261120S3WBWNQG] [ĐƠN VỊ: ] | Đơn hàng đồng bộ tự động từ Shopee #261120S3WBWNQG";
  assert.equal(lamSachGhiChuDonSan(ghiChuLoiThucTe), "");
  assert.equal(laGhiChuTuSinh(ghiChuLoiThucTe), true);

  const ghiChuCoVanDonVaTuyen = "[KHÁCH YÊU CẦU HỦY] Đổi ý | [VẬN ĐƠN: SPXVN05123456] [ĐƠN VỊ: SPX Express] | [TUYẾN: 20-HAN-DD] | [PTTT: COD] | Đơn hàng đồng bộ tự động từ Shopee #261120S3WBWNQG";
  assert.equal(lamSachGhiChuDonSan(ghiChuCoVanDonVaTuyen), "[KHÁCH YÊU CẦU HỦY] Đổi ý");

  const ghiChuKhachNhan = "Giao giờ hành chính | [PTTT: Ví ShopeePay] | [TUYẾN: 1-SGN-HUB] | Đơn hàng đồng bộ tự động từ Shopee #261121EW";
  assert.equal(lamSachGhiChuDonSan(ghiChuKhachNhan), "Giao giờ hành chính");

  assert.equal(laGiaTriAnPii("****"), true);
  assert.equal(laGiaTriAnPii("—"), true);
  assert.equal(laGiaTriAnPii("0901234567"), false);

  assert.equal(laMaVanDonGiaShopee("SPXVN261120S3WBWNQG", "261120S3WBWNQG"), true);
  assert.equal(laMaVanDonGiaShopee("SPXVN05999888", "261120S3WBWNQG"), false);
  assert.equal(laMaVanDonGiaShopee("", "261120S3WBWNQG"), true);
});

test("coTheMoHopGuiSangKho: chan popup voi don 3 san da co kho, chi mo khi bat buoc thu cong", () => {
  const donShopee = don({ kenhBanHang: { maKenh: "SHOPEE_OFFICIAL", tenKenh: "Shopee" }, khoXuat: { id: 1, tenKho: "Kho Tổng" } });
  const donLazada = don({ kenhBanHang: { maKenh: "LAZADA", tenKenh: "Lazada" }, khoXuat: { id: 1, tenKho: "Kho Tổng" } });
  const donTikTok = don({ kenhBanHang: { maKenh: "TIKTOK", tenKenh: "TikTok Shop" }, khoXuat: { id: 1, tenKho: "Kho Tổng" } });
  const donShopify = don({ kenhBanHang: { maKenh: "SHOPIFY", tenKenh: "Shopify" }, khoXuat: { id: 1, tenKho: "Kho Tổng" } });
  const donTrucTiep = don({ kenhBanHang: null, khoXuat: { id: 1, tenKho: "Kho Tổng" } });

  assert.equal(laDonTikTok(donTikTok), true);
  assert.equal(laDonBaSan(donShopee), true);
  assert.equal(laDonBaSan(donLazada), true);
  assert.equal(laDonBaSan(donTikTok), true);
  assert.equal(laDonBaSan(donShopify), false);

  // Đơn 3 sàn đã có kho: luôn chặn mở popup khi bấm bình thường
  assert.equal(coTheMoHopGuiSangKho(donShopee, false), false);
  assert.equal(coTheMoHopGuiSangKho(donLazada, false), false);
  assert.equal(coTheMoHopGuiSangKho(donTikTok, false), false);

  // Chỉ mở popup khi lỗi buộc xử lý thủ công hoặc đơn 3 sàn bị thiếu kho xuất
  assert.equal(coTheMoHopGuiSangKho(donShopee, true), true);
  assert.equal(coTheMoHopGuiSangKho({ ...donTikTok, khoXuat: null }, false), true);

  // Đơn Shopify và đơn bán trực tiếp vẫn mở popup chọn kho bình thường
  assert.equal(coTheMoHopGuiSangKho(donShopify, false), true);
  assert.equal(coTheMoHopGuiSangKho(donTrucTiep, false), true);
});

test("nenMoHopGuiKhoThuCongKhiLoi: chi mo popup chon kho khi loi API gui tu dong hoac thieu/ngung kho", () => {
  // Mở popup chọn kho thủ công khi có mã DON_SAN_CAN_CHON_KHO_THU_CONG hoặc lỗi API hệ thống/mạng
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: "DON_SAN_CAN_CHON_KHO_THU_CONG", status: 409 }), true);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: null }), true);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: 0 }), true);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: 404 }), true);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: 500 }), true);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: 503 }), true);

  // Các lỗi nghiệp vụ từ máy chủ (400, 401, 403, 409 khác, 422) KHÔNG tự bật popup chuyển kho
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: 400 }), false);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: 401 }), false);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: 403 }), false);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: "TRANG_THAI_KHONG_HOP_LE", status: 409 }), false);
  assert.equal(nenMoHopGuiKhoThuCongKhiLoi({ maLoi: null, status: 422 }), false);
});

// ── Kho xuất thiếu hàng (dải cảnh báo PA B) ─────────────────────────────────
const ctThieu = (thieuTonKhoXuat, extra = {}) => ({
  donBanHang: don({ trangThai: 1, khoXuat: { id: 7, tenKho: "Cửa hàng Hà Nội" } }),
  chiTiet: [
    { id: 1, bienTheSanPhamId: 101, sku: "AP-M", tenSanPhamGoc: "Áo polo", tenMau: "Xanh Than", kichCo: "M", soLuongDat: 1, donGia: 120000 },
    { id: 2, bienTheSanPhamId: 102, sku: "QK-L", tenSanPhamGoc: "Quần kaki", tenMau: "Ghi", kichCo: "L", soLuongDat: 2, donGia: 185000 },
  ],
  thieuTonKhoXuat,
  ...extra,
});

test("thieuTonDonBan: ghép tên/biến thể theo dòng đơn, bỏ dòng không thiếu, Map số thiếu", () => {
  const th = thieuTonDonBan(ctThieu({
    khoId: 7,
    tenKho: "Cửa hàng Hà Nội",
    dong: [
      { bienTheId: 101, maSku: "AP-M", soLuongCan: 1, tonKhaDung: 0, soLuongThieu: 1 },
      { bienTheId: 102, maSku: "QK-L", soLuongCan: 2, tonKhaDung: 2, soLuongThieu: 0 },
    ],
  }));
  assert.equal(th.tenKho, "Cửa hàng Hà Nội");
  assert.equal(th.dong.length, 1);
  assert.equal(th.dong[0].tenSanPham, "Áo polo");
  assert.match(th.dong[0].nhanBienThe, /Xanh Than/);
  assert.deepEqual([th.dong[0].can, th.dong[0].con, th.dong[0].thieu], [1, 0, 1]);
  assert.equal(th.thieuTheoBienThe.get(101), 1);
  assert.equal(th.thieuTheoBienThe.has(102), false);
});

test("thieuTonDonBan: null khi máy chủ không trả, không còn dòng thiếu, hoặc đơn không ở Chờ nhặt hàng", () => {
  assert.equal(thieuTonDonBan(ctThieu(null)), null);
  assert.equal(thieuTonDonBan(ctThieu({ khoId: 7, dong: [] })), null);
  const daDongGoi = ctThieu({ khoId: 7, dong: [{ bienTheId: 101, soLuongCan: 1, tonKhaDung: 0, soLuongThieu: 1 }] });
  daDongGoi.donBanHang.trangThai = 7;
  assert.equal(thieuTonDonBan(daDongGoi), null);
});

test("thieuTonDonBan: kho đang kiểm kê toàn kho vẫn ra dải dù không có dòng", () => {
  const th = thieuTonDonBan(ctThieu({ khoId: 7, tenKho: "Cửa hàng Hà Nội", dotKiemKeToanKho: "KK-0012", dong: [] }));
  assert.equal(th.dotKiemKe, "KK-0012");
  assert.equal(th.dong.length, 0);
});

test("thongBaoDonBan: có dải thiếu hàng thì bỏ dòng chờ kho gom", () => {
  const coThieu = ctThieu({ khoId: 7, dong: [{ bienTheId: 101, soLuongCan: 1, tonKhaDung: 0, soLuongThieu: 1 }] });
  assert.equal(thongBaoDonBan(coThieu, { laKho: true }).some((n) => n.ma === "choGom"), false);
  assert.equal(thongBaoDonBan(ctThieu(null), { laKho: true }).some((n) => n.ma === "choGom"), true);
});

test("dongHangBan: gắn số thiếu tại kho theo biến thể", () => {
  const ct = ctThieu({ khoId: 7, dong: [{ bienTheId: 102, soLuongCan: 2, tonKhaDung: 1, soLuongThieu: 1 }] });
  const dong = dongHangBan(ct.chiTiet, thieuTonDonBan(ct).thieuTheoBienThe);
  assert.deepEqual(dong.map((d) => d.thieuTaiKho), [0, 1]);
  assert.deepEqual(dongHangBan(ct.chiTiet).map((d) => d.thieuTaiKho), [0, 0]);
});

test("duongDanChuyenKhoBu: kho nhận là kho xuất; một dòng thiếu thì điền sẵn sản phẩm và số thiếu", () => {
  const motDong = thieuTonDonBan(ctThieu({ khoId: 7, dong: [{ bienTheId: 101, soLuongCan: 3, tonKhaDung: 1, soLuongThieu: 2 }] }));
  assert.equal(duongDanChuyenKhoBu(motDong), "/transfer-tickets/create?khoNhapId=7&bienTheId=101&soLuong=2");
  const haiDong = thieuTonDonBan(ctThieu({
    khoId: 7,
    dong: [
      { bienTheId: 101, soLuongCan: 1, tonKhaDung: 0, soLuongThieu: 1 },
      { bienTheId: 102, soLuongCan: 2, tonKhaDung: 0, soLuongThieu: 2 },
    ],
  }));
  assert.equal(duongDanChuyenKhoBu(haiDong), "/transfer-tickets/create?khoNhapId=7");
  assert.equal(duongDanChuyenKhoBu(null), "/transfer-tickets/create");
});

test("laDonTikTok & thongBaoDonBan cho đơn 3 sàn (Shopee, TikTok, Lazada): hiện đúng thông báo chuyển thẳng tới kho đã ánh xạ", () => {
  assert.equal(laDonTikTok({ soDonHang: "TTS-999" }), true);
  assert.equal(laDonTikTok({ maDonHangKenh: "TTS-888" }), true);
  assert.equal(laDonTikTok({ soDonHang: "SHP-111" }), false);

  for (const [maKenh, tenKenh] of [
    ["SHOPEE_OFFICIAL", "Shopee"],
    ["SHOPEE_SANDBOX", "Shopee Sandbox"],
    ["TIKTOK", "TikTok Shop"],
    ["LAZADA", "Lazada"],
  ]) {
    const tb = thongBaoDonBan(
      ct({ kenhBanHang: { maKenh, tenKenh }, khoXuat: { id: 2, tenKho: "Cửa hàng Hà Nội" }, trangThai: 0 }),
      { laBan: true },
    );
    assert.match(
      tb[0].chu,
      /được định tuyến về Cửa hàng Hà Nội\. Bấm Gửi sang kho để chuyển thẳng sang kho này\./,
      `${maKenh} phải báo rõ bấm Gửi sang kho để chuyển thẳng tới Cửa hàng Hà Nội`,
    );
  }
});
