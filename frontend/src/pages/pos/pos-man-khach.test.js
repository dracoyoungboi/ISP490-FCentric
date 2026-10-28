// Chạy: node --test src/pages/pos/pos-man-khach.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matDoDanhSach, noiDungManKhach, trangThaiManKhach } from "./pos-man-khach.js";

const NOW = Date.parse("2026-10-28T10:00:00Z");
const sp = (id, name, price, them = {}) => ({ id, variantId: id, name, price, sku: `SKU-${id}`, stock: 5, barcode: "893000" + id, image: `/anh/${id}.png`, ...them });
const hoaDon = (patch = {}) => ({
  number: 2,
  cart: [
    { product: sp(11, "Áo thun basic · Đen · M", 199000, { tenMau: "Đen", tenSize: "M" }), quantity: 2 },
    { product: sp(12, "Quần jean · Xanh · 30", 549000, { tenMau: "Xanh", tenSize: "30", image: null }), quantity: 1 },
  ],
  note: "khách quen, giảm lần sau",
  customer: { id: 5, code: "KH001", name: "Nguyễn Minh Anh", phone: "0912345678" },
  warehouseId: 3,
  paymentMethod: "cash",
  paymentAmount: 947000,
  attempt: null,
  payos: null,
  ...patch,
});
const ma = (giay, trangThai = "PENDING", them = {}) => ({
  orderCode: 123456,
  trangThai,
  qrCode: "00020101021238...",
  soTien: 947000,
  hetHanLuc: new Date(NOW + giay * 1000).toISOString(),
  tenTaiKhoan: "CONG TY F CENTRIC",
  checkoutUrl: "https://pay.payos.vn/web/abc",
  noiDungCk: "CSABC FC2",
  ...them,
});

test("Giỏ hàng: chỉ mang tên, số lượng, giá, tổng — không SKU, tồn, ghi chú, kho, mã giao dịch", () => {
  const nd = noiDungManKhach(hoaDon());
  assert.deepEqual(nd.dong, [
    { id: "11", ten: "Áo thun basic", bienThe: "Đen · M", soLuong: 2, donGia: 199000, thanhTien: 398000 },
    { id: "12", ten: "Quần jean", bienThe: "Xanh · 30", soLuong: 1, donGia: 549000, thanhTien: 549000 },
  ]);
  assert.equal(nd.tongTienHang, 947000);
  assert.equal(nd.giamGia, 0);
  assert.equal(nd.tong, 947000);
  assert.equal(nd.soLuong, 3);
  assert.equal(nd.khachHang, "Nguyễn Minh Anh");
  const json = JSON.stringify(noiDungManKhach(hoaDon({ payos: ma(600) }), { dialog: "payos-qr" }));
  for (const lo of ["SKU-", "893000", "/anh/", "0912345678", "khách quen", "orderCode", "123456", "checkoutUrl", "CSABC", "warehouseId", "stock"]) {
    assert.ok(!json.includes(lo), lo);
  }
  assert.deepEqual(trangThaiManKhach(nd, NOW), { loai: "gio" });
  assert.equal(noiDungManKhach(null), null);
  assert.deepEqual(trangThaiManKhach(null, NOW), { loai: "trong" });
});

test("Tên gốc tách khỏi màu / cỡ; tên không khớp (nháp cũ, thiếu màu cỡ) thì giữ nguyên", () => {
  const ten = (product) => noiDungManKhach({ cart: [{ product, quantity: 1 }] }).dong[0];
  assert.deepEqual([ten(sp(1, "Áo · Đen", 1, { tenMau: "Đen" })).ten, ten(sp(1, "Áo · Đen", 1, { tenMau: "Đen" })).bienThe], ["Áo", "Đen"]);
  assert.deepEqual([ten(sp(1, "Áo · M", 1, { tenSize: "M" })).ten, ten(sp(1, "Áo · M", 1, { tenSize: "M" })).bienThe], ["Áo", "M"]);
  assert.deepEqual([ten(sp(1, "Áo · Đen · M", 1)).ten, ten(sp(1, "Áo · Đen · M", 1)).bienThe], ["Áo · Đen · M", ""]);
  assert.deepEqual([ten(sp(1, "Áo khác", 1, { tenMau: "Đen" })).ten, ten(sp(1, "Áo khác", 1, { tenMau: "Đen" })).bienThe], ["Áo khác", ""]);
  // Tên chỉ có phần biến thể: không cắt thành tên rỗng
  assert.equal(ten(sp(1, " · Đen", 1, { tenMau: "Đen" })).ten, " · Đen");
});

test("Mật độ danh sách: hai tầng tới 8 món, gọn một dòng từ 9", () => {
  assert.deepEqual([1, 8, 9, 40].map(matDoDanhSach), ["thuong", "thuong", "gon", "gon"]);
});

test("Tên khách: chỉ hiện khi đã chọn khách cụ thể, khách lẻ / chưa chọn thì không", () => {
  const khach = (customer) => noiDungManKhach(hoaDon({ customer }), { maKhachLe: "KHLE" }).khachHang;
  assert.equal(khach({ id: 1, code: "KHLE", name: "Khách lẻ" }), null);
  assert.equal(khach(null), null);
  assert.equal(khach({ id: 2, code: "KH002", name: "" }), null);
  assert.equal(khach({ id: 3, code: "KH003", name: "Trần Bình" }), "Trần Bình");
});

test("Giỏ trống thì màn khách về lời chào; có mã QR thì vẫn hiện mã", () => {
  assert.equal(trangThaiManKhach(noiDungManKhach(hoaDon({ cart: [] })), NOW).loai, "trong");
  assert.equal(trangThaiManKhach(noiDungManKhach(hoaDon()), NOW).loai, "gio");
  assert.equal(trangThaiManKhach(noiDungManKhach(hoaDon({ cart: [], payos: ma(600) })), NOW).loai, "qr");
});

test("Thu tiền mặt: chỉ hiện khách đưa / tiền thừa ở hộp Thanh toán, khi khách đưa nhiều hơn tổng", () => {
  const dua = (paymentAmount, dialog = "payment", them = {}) => noiDungManKhach(hoaDon({ paymentAmount, ...them }), { dialog, payosEnabled: true }).tienMat;
  assert.deepEqual(dua(1000000), { khachDua: 1000000, tienThua: 53000 });
  assert.equal(dua(947000), null); // mặc định ô số tiền = đủ tổng
  assert.equal(dua(500000), null);
  assert.equal(dua(1000000, null), null); // chưa mở hộp Thanh toán
  assert.equal(dua(1000000, "payment", { paymentMethod: "transfer" }), null);
  // Chuyển khoản đang chọn nhưng payOS tắt: hộp Thanh toán thật ra là tiền mặt
  assert.deepEqual(noiDungManKhach(hoaDon({ paymentAmount: 1000000, paymentMethod: "transfer" }), { dialog: "payment", payosEnabled: false }).tienMat,
    { khachDua: 1000000, tienThua: 53000 });
});

test("Mã QR đang chờ: hiện mã, 30 giây cuối báo sắp hết, về 00:00 thì ẩn mã ngay (cùng giờ với hộp mã QR)", () => {
  const nd = (giay, them) => noiDungManKhach(hoaDon({ payos: ma(giay, "PENDING", them) }));
  assert.deepEqual(trangThaiManKhach(nd(600), NOW), { loai: "qr", sapHet: false, conLaiMs: 600000 });
  assert.deepEqual(trangThaiManKhach(nd(30), NOW), { loai: "qr", sapHet: true, conLaiMs: 30000 });
  assert.deepEqual(trangThaiManKhach(nd(0), NOW), { loai: "hetGio" });
  assert.deepEqual(trangThaiManKhach(nd(-5), NOW), { loai: "hetGio" });
  // Giờ hết hạn theo máy quầy (đã bù lệch giờ máy chủ) được ưu tiên như hộp mã QR
  assert.deepEqual(trangThaiManKhach(nd(600, { hetHanMay: NOW - 1 }), NOW), { loai: "hetGio" });
  assert.deepEqual(trangThaiManKhach(nd(600, { qrCode: "" }), NOW), { loai: "choMa" });
  const q = nd(600, { tienMatTruoc: 200000, soTien: 747000 }).qr;
  assert.equal(q.tienMatTruoc, 200000);
  assert.equal(q.soTien, 747000);
  assert.equal(q.tenTaiKhoan, "CONG TY F CENTRIC");
});

test("Mã đã đóng chỉ hiện khi thu ngân đang mở hộp mã QR hoặc còn phải trả lại tiền mặt", () => {
  for (const tt of ["EXPIRED", "CANCELLED", "FAILED"]) {
    const dangMo = noiDungManKhach(hoaDon({ payos: ma(-60, tt) }), { dialog: "payos-qr" });
    assert.deepEqual(trangThaiManKhach(dangMo, NOW), { loai: "maDong", trangThai: tt }, tt);
    // Mã đã đóng: không gửi nội dung mã sang màn hình phụ dù không vẽ
    assert.equal(dangMo.qr.maQr, null, tt);
    // Thu ngân đã đóng hộp mã QR, quay về sửa giỏ: khách thấy lại giỏ, không kẹt ở "mã đã hết hạn"
    const daDong = noiDungManKhach(hoaDon({ payos: ma(-60, tt) }), { dialog: null });
    assert.deepEqual(trangThaiManKhach(daDong, NOW), { loai: "gio" }, tt);
  }
  const conTraLai = noiDungManKhach(hoaDon({ payos: ma(-60, "EXPIRED", { tienMatTruoc: 200000 }) }), { dialog: null });
  assert.deepEqual(trangThaiManKhach(conTraLai, NOW), { loai: "maDong", trangThai: "EXPIRED" });
  assert.equal(conTraLai.qr.traLaiTienMat, true);
  const daTraLai = noiDungManKhach(hoaDon({ payos: ma(-60, "EXPIRED", { tienMatTruoc: 200000, tienMatTraLaiLuc: "2026-10-28T10:01:00Z" }) }));
  assert.deepEqual(trangThaiManKhach(daTraLai, NOW), { loai: "gio" });
  // Đã trả lại tiền mặt mà thu ngân còn mở hộp mã QR: không hiện "Đã nhận tiền mặt" nữa
  const daTraLaiDangMo = noiDungManKhach(hoaDon({ payos: ma(-60, "EXPIRED", { tienMatTruoc: 200000, tienMatTraLaiLuc: "2026-10-28T10:01:00Z" }) }), { dialog: "payos-qr" });
  assert.equal(daTraLaiDangMo.qr.tienMatTruoc, 0);
  assert.equal(daTraLaiDangMo.qr.traLaiTienMat, false);
  // Quản lý đã hoàn khoản chuyển khoản mà tiền mặt đưa trước còn ở quầy: khách thấy sẽ được trả lại
  const hoanConTienMat = noiDungManKhach(hoaDon({ payos: ma(-60, "REFUNDED", { tienMatTruoc: 200000 }) }));
  assert.deepEqual(trangThaiManKhach(hoanConTienMat, NOW), { loai: "maDong", trangThai: "REFUNDED" });
  assert.equal(hoanConTienMat.qr.traLaiTienMat, true);
  // Giỏ trống + mã đã hết hạn, thu ngân không mở hộp mã QR: màn khách về lời chào
  assert.equal(trangThaiManKhach(noiDungManKhach(hoaDon({ cart: [], payos: ma(-60, "EXPIRED") }), { dialog: null }), NOW).loai, "trong");
});

test("Mã đang chờ không có giờ hết hạn: vẫn hiện mã, không có đồng hồ", () => {
  const nd = noiDungManKhach(hoaDon({ payos: ma(0, "PENDING", { hetHanLuc: null }) }));
  assert.deepEqual(trangThaiManKhach(nd, NOW), { loai: "qr", sapHet: false, conLaiMs: null });
  assert.deepEqual(trangThaiManKhach(noiDungManKhach(hoaDon({ payos: ma(31) })), NOW), { loai: "qr", sapHet: false, conLaiMs: 31000 });
});

test("Đã nhận tiền nhưng chưa tạo được đơn: chỉ báo khách chờ", () => {
  const nd = noiDungManKhach(hoaDon({ payos: ma(600, "PAID_ERROR") }));
  assert.deepEqual(trangThaiManKhach(nd, NOW), { loai: "kiemTra" });
});

test("Đã nhận đủ tiền: chuyển khoản, kết hợp, tiền mặt kèm khách đưa và tiền thừa", () => {
  const qr = noiDungManKhach(hoaDon({ payos: ma(600, "PAID", { result: { tongCong: 947000, soTienThu: 947000 } }) }), { dialog: "receipt" });
  assert.deepEqual(trangThaiManKhach(qr, NOW), { loai: "daNhan" });
  assert.deepEqual(qr.daNhan, { tong: 947000, tienThua: 0, hinhThuc: "chuyenKhoan" });
  assert.equal(qr.qr, null);
  const tienMat = noiDungManKhach(hoaDon({ attempt: { status: "succeeded", result: { tongCong: 947000, soTienThu: 1000000, soTienThua: 53000 } } }), { dialog: "receipt" });
  assert.deepEqual(tienMat.daNhan, { tong: 947000, tienThua: 53000, hinhThuc: "tienMat", khachDua: 1000000 });
  assert.equal(tienMat.tienMat, null);
  // Kết quả cũ thiếu số khách đưa: suy ra từ tổng + tiền thừa
  const thieuKhachDua = noiDungManKhach(hoaDon({ attempt: { status: "succeeded", result: { tongCong: 947000, soTienThua: 53000 } } }));
  assert.equal(thieuKhachDua.daNhan.khachDua, 1000000);
  // Chưa có kết quả máy chủ (chưa thanh toán xong): không phải đã nhận
  const dangGui = noiDungManKhach(hoaDon({ attempt: { status: "pending", result: null } }));
  assert.equal(dangGui.daNhan, null);
  // payOS báo đã trả nhưng chưa kèm kết quả đơn: vẫn là đã nhận, tổng theo giỏ
  const thieuKetQua = noiDungManKhach(hoaDon({ payos: ma(600, "PAID") }));
  assert.deepEqual(thieuKetQua.daNhan, { tong: 947000, tienThua: 0, hinhThuc: "chuyenKhoan" });
  // Trả kết hợp tiền mặt + QR: tách phần tiền mặt / chuyển khoản, không hiện "tiền thừa" của phần tiền mặt
  const ketHop = noiDungManKhach(hoaDon({ payos: ma(600, "PAID", { tienMatTruoc: 200000, result: { tongCong: 947000, soTienThua: 53000 } }) }));
  assert.deepEqual(ketHop.daNhan, { tong: 947000, tienThua: 0, hinhThuc: "ketHop", tienMat: 200000, chuyenKhoan: 747000 });
  // Tiền mặt đưa trước chỉ có trong kết quả đơn (mã đã tải lại sau khi trả): vẫn nhận ra trả kết hợp
  const ketHopTuKetQua = noiDungManKhach(hoaDon({ payos: ma(600, "PAID", { result: { tongCong: 947000, tienMatTruoc: 300000 } }) }));
  assert.deepEqual(ketHopTuKetQua.daNhan, { tong: 947000, tienThua: 0, hinhThuc: "ketHop", tienMat: 300000, chuyenKhoan: 647000 });
  // Giỏ trống (nháp cũ) + mã đã trả mà chưa kèm kết quả đơn: số đã nhận lấy theo mã, không phải 0 ₫
  const trongGio = noiDungManKhach(hoaDon({ cart: [], payos: ma(600, "PAID", { soTien: 747000, tienMatTruoc: 200000 }) }));
  assert.deepEqual(trongGio.daNhan, { tong: 947000, tienThua: 0, hinhThuc: "ketHop", tienMat: 200000, chuyenKhoan: 747000 });
  // Kết quả chuyển khoản (payOS) nằm ở lần thanh toán: vẫn là chuyển khoản / kết hợp, không ghi thành tiền mặt
  const payosTrongAttempt = noiDungManKhach(hoaDon({ attempt: { status: "succeeded", result: { phuongThuc: "PAYOS", tongCong: 947000, tienMatTruoc: 200000 } } }));
  assert.deepEqual(payosTrongAttempt.daNhan, { tong: 947000, tienThua: 0, hinhThuc: "ketHop", tienMat: 200000, chuyenKhoan: 747000 });
});

test("Tên cửa hàng và có chuyển khoản hay không: cho chân màn chờ khách", () => {
  const nd = noiDungManKhach(hoaDon({ cart: [] }), { tenCuaHang: "Cửa hàng Hà Nội", payosEnabled: true });
  assert.equal(nd.cuaHang, "Cửa hàng Hà Nội");
  assert.equal(nd.coChuyenKhoan, true);
  const macDinh = noiDungManKhach(hoaDon());
  assert.equal(macDinh.cuaHang, null);
  assert.equal(macDinh.coChuyenKhoan, false);
});
