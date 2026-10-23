// Chạy: node --test src/components/ban-hang/chi-tiet-don-ban/tinhDonBan.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buocDonBan,
  dongHangBan,
  ghiChuKhiXuat,
  gioNgay,
  hauQuaHuy,
  laDonSan,
  laDonTaiQuay,
  laGhiChuTuSinh,
  lyDoKhoaHuy,
  lyDoSanHuy,
  maBaoGiaGoc,
  phieuDaXuatCuoi,
  tachTenDong,
  thanhToanDonBan,
  thaoTacDonBan,
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

test("maBaoGiaGoc: SO→BG bỏ hậu tố, không suy với đơn tại quầy / đơn sàn", () => {
  assert.equal(maBaoGiaGoc("SO202610217"), "BG202610217");
  assert.equal(maBaoGiaGoc("SO202610217-1"), "BG202610217");
  assert.equal(maBaoGiaGoc("SO202610171", { laPos: true }), null);
  assert.equal(maBaoGiaGoc("SHP-1021", { laSan: true }), null);
  assert.equal(maBaoGiaGoc("DH1"), null);
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
  // Đơn Shopify: giữ nghiệp vụ cũ, bán hàng vẫn thao tác như đơn thường
  assert.equal(thaoTacDonBan(ct({ ...shopify, trangThai: 0 }), ban).nutGuiKho, true);
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
  assert.equal(hauQuaHuy(ct(), { baoGia: { ma: "BG1", chacChan: true } })[1], "Báo giá BG1 đang Đã chốt đơn sẽ trở lại Chờ phản hồi.");
  assert.equal(hauQuaHuy(ct(), { baoGia: { ma: "BG1" } })[1], "Báo giá BG1 (nếu đang Đã chốt đơn) sẽ trở lại Chờ phản hồi.");
  const san = hauQuaHuy(ct({ ...shopify, trangThaiThanhToan: "da_thanh_toan" }));
  assert.equal(san.length, 3);
  assert.match(san[2], /Không tự hoàn tiền/);
  assert.equal(thanhToanDonBan(ct()).maTrangThai, null);
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
