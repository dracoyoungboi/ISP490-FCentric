/**
 * Màn hình phụ quay về phía khách. Hàm thuần: dựng nội dung từ hóa đơn đang mở và chọn trạng thái hiển thị theo đồng
 * hồ máy quầy.
 *
 * Màn khách là "gương" của giỏ thu ngân và hóa đơn in: cùng thứ tự dòng, cùng con số, để khách đối chiếu từng dòng.
 * Nội dung CHỈ mang thứ khách được thấy — tên cửa hàng, tên khách (không số điện thoại), tên hàng (kèm màu, cỡ), số
 * lượng, giá, tổng, mã QR, chủ tài khoản. Không SKU, tồn kho, ghi chú hóa đơn, mã giao dịch, lỗi kỹ thuật. Kết quả là
 * dữ liệu thuần, gửi được qua BroadcastChannel.
 */
import { canTraLaiTienMat, msToiHetHan, phaMaQr, tienMatTruocCua } from "./pos-payment.js";

/** Mã QR đã đóng mà không nhận được tiền. */
const MA_DONG = ["EXPIRED", "CANCELLED", "FAILED", "REFUNDED"];

/**
 * Mật độ danh sách hàng theo số dòng: ít món thì mỗi món hai tầng (tên; màu · cỡ · đơn giá); nhiều món thì gọn, mỗi
 * món một dòng (tên · màu · cỡ). Cả hai đều có số thứ tự, số lượng, thành tiền.
 */
export const GON_TU = 9;
export const matDoDanhSach = (soDong) => (soDong >= GON_TU ? "gon" : "thuong");

/**
 * Tên gốc và biến thể ("Đen · S") của một dòng: tên trong giỏ đã ghép sẵn "tên · màu · cỡ" (posService.toPosProduct);
 * tách ra để màn khách in đậm tên, biến thể chữ nhạt. Không khớp (dữ liệu nháp cũ) thì giữ nguyên tên.
 */
function tachTen(product) {
  const ten = product?.name || "";
  const bienThe = [product?.tenMau, product?.tenSize].filter(Boolean).join(" · ");
  const duoi = ` · ${bienThe}`;
  if (bienThe && ten.endsWith(duoi) && ten.length > duoi.length) return { ten: ten.slice(0, -duoi.length), bienThe };
  return { ten, bienThe: "" };
}

/**
 * Nội dung màn cho khách của một hóa đơn (null = không có hóa đơn).
 * - `dialog`: hộp thoại đang mở trên màn quầy — mã QR đã đóng chỉ hiện khi thu ngân đang mở hộp mã QR (hoặc còn phải
 *   trả lại tiền mặt), không thì khách thấy lại giỏ hàng (thu ngân đã quay về sửa giỏ / bán tiếp).
 * - `payosEnabled`: hộp Thanh toán đang chọn chuyển khoản thì không hiện dòng "Khách đưa · Tiền thừa".
 * - `maKhachLe`: mã khách lẻ — hóa đơn của khách lẻ không hiện tên khách (chỉ hiện khi đã chọn khách cụ thể).
 * - `tenCuaHang`: tên cửa hàng đang bán (chân màn chờ khách).
 */
export function noiDungManKhach(invoice, { dialog = null, payosEnabled = false, maKhachLe = null, tenCuaHang = null } = {}) {
  if (!invoice) return null;
  const dong = (invoice.cart ?? []).map(({ product, quantity }) => {
    const donGia = Number(product?.price) || 0;
    const soLuong = Number(quantity) || 0;
    return {
      id: String(product?.variantId ?? product?.id ?? ""),
      ...tachTen(product),
      soLuong,
      donGia,
      thanhTien: donGia * soLuong,
    };
  });
  // Chưa có giảm giá tại quầy: tổng tiền hàng = khách cần trả. Giữ hai số riêng để màn khách tự hiện dòng
  // "Giảm giá" khi có (dòng chỉ hiện khi giảm giá > 0).
  const tongTienHang = dong.reduce((sum, d) => sum + d.thanhTien, 0);
  const giamGia = 0;
  const tong = tongTienHang - giamGia;
  // Chỉ tên (không số điện thoại); khách lẻ thì không hiện
  const khach = invoice.customer;
  const khachHang = khach?.name && !(maKhachLe && khach.code === maKhachLe) ? khach.name : null;
  const soLuong = dong.reduce((sum, d) => sum + d.soLuong, 0);
  const link = invoice.payos ?? null;
  const ketQua = invoice.attempt?.status === "succeeded" ? invoice.attempt.result : null;
  const traQr = link?.trangThai === "PAID";

  // Đã nhận đủ: số tiền và hình thức để khách đối chiếu — tiền mặt (khách đưa, tiền thừa), chuyển khoản, hay kết hợp
  // (tiền mặt đưa trước + phần quét mã)
  let daNhan = null;
  if (traQr || ketQua) {
    const ketQuaNhan = traQr ? link.result ?? null : ketQua;
    const quaQr = traQr || ketQuaNhan?.phuongThuc === "PAYOS";
    // Kết quả thiếu tổng mà giỏ trống (nháp cũ): lấy theo mã — số chuyển khoản + tiền mặt đưa trước, không hiện 0 ₫
    const tongNhan = Number(ketQuaNhan?.tongCong)
      || (dong.length || !link ? tong : (Number(link.soTien) || 0) + tienMatTruocCua(link));
    if (quaQr) {
      const tienMatTruoc = tienMatTruocCua(link) || tienMatTruocCua(ketQuaNhan);
      daNhan = tienMatTruoc > 0
        ? { tong: tongNhan, tienThua: 0, hinhThuc: "ketHop", tienMat: tienMatTruoc, chuyenKhoan: Math.max(0, tongNhan - tienMatTruoc) }
        : { tong: tongNhan, tienThua: 0, hinhThuc: "chuyenKhoan" };
    } else {
      const thua = Number(ketQuaNhan.soTienThua);
      const khachDuaThat = Number(ketQuaNhan.soTienThu);
      daNhan = {
        tong: tongNhan,
        tienThua: thua > 0 ? thua : 0,
        hinhThuc: "tienMat",
        khachDua: khachDuaThat > 0 ? khachDuaThat : tongNhan + (thua > 0 ? thua : 0),
      };
    }
  }

  // Thu tiền mặt: khách đưa nhiều hơn tổng thì cho khách thấy tiền thừa (mặc định ô số tiền = đủ tổng, không hiện)
  let tienMat = null;
  const chonChuyenKhoan = invoice.paymentMethod === "transfer" && payosEnabled;
  const khachDua = Number(invoice.paymentAmount);
  if (!daNhan && dialog === "payment" && !chonChuyenKhoan && Number.isFinite(khachDua) && khachDua > tong && tong > 0) {
    tienMat = { khachDua, tienThua: khachDua - tong };
  }

  let qr = null;
  if (link && !daNhan) {
    const traLaiTienMat = canTraLaiTienMat(link);
    const conHieuLuc = link.trangThai === "PENDING" || link.trangThai === "PAID_ERROR";
    const dangXemMaDong = MA_DONG.includes(link.trangThai) && (dialog === "payos-qr" || traLaiTienMat);
    if (conHieuLuc || dangXemMaDong) {
      qr = {
        trangThai: link.trangThai,
        // Nội dung mã chỉ đi kèm khi mã còn chờ: mã đã đóng không được gửi sang màn hình phụ dù không vẽ ra
        maQr: link.trangThai === "PENDING" ? link.qrCode || null : null,
        soTien: Number(link.soTien) || 0,
        // Tiền mặt đưa trước đã trả lại khách: không còn là "đã nhận tiền mặt"
        tienMatTruoc: link.tienMatTraLaiLuc ? 0 : tienMatTruocCua(link),
        traLaiTienMat,
        hetHanLuc: link.hetHanLuc ?? null,
        hetHanMay: Number.isFinite(link.hetHanMay) ? link.hetHanMay : null,
        tenTaiKhoan: link.tenTaiKhoan || null,
      };
    }
  }

  return {
    soHoaDon: invoice.number ?? null,
    cuaHang: tenCuaHang || null,
    coChuyenKhoan: Boolean(payosEnabled),
    khachHang, dong, soLuong, tongTienHang, giamGia, tong, tienMat, qr, daNhan,
  };
}

/**
 * Trạng thái màn cho khách tại thời điểm `now` (đồng hồ máy quầy, cùng cách tính với hộp mã QR nên hai nơi ẩn mã cùng
 * lúc — không bao giờ hiện mã đã quá giờ):
 * - trong: chưa có hàng (màn hình phụ hiện lời chào)
 * - gio: danh sách hàng + tổng (kèm khách đưa / tiền thừa khi thu tiền mặt)
 * - qr: mã QR đang chờ (sapHet = 30 giây cuối, conLaiMs = còn lại)
 * - choMa: mã đang chờ nhưng chưa có nội dung mã
 * - hetGio: mã vừa về 00:00, máy quầy đang đóng mã (tiền khách vừa chuyển vẫn có thể về)
 * - maDong: mã đã hết hạn / hủy / lỗi / hoàn tiền (không vẽ mã)
 * - kiemTra: đã nhận tiền nhưng chưa tạo được đơn — chỉ báo khách chờ, không nói lỗi
 * - daNhan: đã nhận đủ tiền
 */
export function trangThaiManKhach(noiDung, now = Date.now()) {
  if (!noiDung) return { loai: "trong" };
  if (noiDung.daNhan) return { loai: "daNhan" };
  const qr = noiDung.qr;
  if (qr) {
    if (qr.trangThai === "PENDING") {
      const pha = phaMaQr(qr, now);
      if (pha === "hetGio") return { loai: "hetGio" };
      if (!qr.maQr) return { loai: "choMa" };
      return { loai: "qr", sapHet: pha === "sapHet", conLaiMs: msToiHetHan(qr, now) };
    }
    if (qr.trangThai === "PAID_ERROR") return { loai: "kiemTra" };
    if (MA_DONG.includes(qr.trangThai)) return { loai: "maDong", trangThai: qr.trangThai };
  }
  return noiDung.dong.length ? { loai: "gio" } : { loai: "trong" };
}
