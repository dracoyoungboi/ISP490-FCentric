/**
 * Trả kết hợp tại quầy (hàm thuần, cùng quy tắc với máy chủ PosPayosTransaction.tienMatTruocQr): khách đưa trước một
 * phần bằng tiền mặt, mã QR payOS chỉ mang phần còn lại. Không nhập tiền mặt (trống / 0) = mã QR trọn hóa đơn như cũ.
 */

/** Phần quét mã QR nhỏ nhất khi khách đưa trước tiền mặt (máy chủ cũng chặn). */
export const MIN_QR = 2000;

/** Trạng thái mã QR không thành (khách không mua được bằng mã này): tiền mặt đưa trước phải trả lại khách. */
const TRANG_THAI_PHAI_TRA_LAI = ["CANCELLED", "EXPIRED", "FAILED", "REFUNDED"];

const tien = (v) => `${Number(v).toLocaleString("vi-VN")} ₫`;

/**
 * Kiểm số tiền mặt khách đưa trước khi tạo mã QR. Trả { tienMat, soTienQr, loi } — loi = null là tạo mã được;
 * tienMat = 0 nghĩa là không có tiền mặt (mã QR trọn hóa đơn, không gửi tienMatTruoc lên máy chủ).
 */
export function kiemTienMatTruocQr(total, value) {
  const tong = Number(total) > 0 ? Math.round(Number(total)) : 0;
  const khongCo = { tienMat: 0, soTienQr: tong, loi: null };
  if (value === "" || value == null) return khongCo;
  const n = Number(value);
  if (!Number.isFinite(n)) return { ...khongCo, loi: "Nhập số tiền mặt khách đưa trước bằng chữ số." };
  if (n === 0) return khongCo;
  if (n < 0) return { ...khongCo, loi: "Tiền mặt khách đưa trước không được âm." };
  if (!Number.isInteger(n)) return { ...khongCo, loi: "Tiền mặt khách đưa trước phải là số đồng chẵn (không có số lẻ)." };
  const kq = { tienMat: n, soTienQr: tong - n, loi: null };
  if (n >= tong) {
    return { ...kq, soTienQr: 0, loi: "Khách đưa đủ tiền mặt cho cả hóa đơn — chọn Tiền mặt thay vì tạo mã QR." };
  }
  if (tong - n < MIN_QR) return { ...kq, loi: `Phần quét mã QR phải từ ${tien(MIN_QR)} trở lên — giảm số tiền mặt hoặc thu cả hóa đơn bằng tiền mặt.` };
  return kq;
}

/** Số tiền mặt khách đưa trước của một mã QR (0 = không có). */
export const tienMatTruocCua = (link) => (Number(link?.tienMatTruoc) > 0 ? Number(link.tienMatTruoc) : 0);

/** Mã QR có tiền mặt khách đưa trước mà chưa ai xác nhận đã trả lại khách. */
export const tienMatChuaTraLai = (link) => tienMatTruocCua(link) > 0 && !link?.tienMatTraLaiLuc;

/**
 * Phải trả lại khách tiền mặt đưa trước và xác nhận "Đã trả lại tiền mặt": mã QR không thành (hủy / hết hạn / lỗi /
 * quản lý đã hoàn khoản chuyển khoản), hoặc tiền chuyển khoản về sau khi mã đã hủy (PAID_ERROR + tienVeSauHuy, chỉ
 * màn Đối soát có cờ này). Mã còn chờ, đơn đã tạo, giao dịch đang chờ quản lý xử lý thì không.
 */
export function canTraLaiTienMat(link) {
  if (!tienMatChuaTraLai(link)) return false;
  if (TRANG_THAI_PHAI_TRA_LAI.includes(link.trangThai)) return true;
  return link.trangThai === "PAID_ERROR" && Boolean(link.tienVeSauHuy);
}

/**
 * Kết quả thanh toán trả kết hợp (PAYOS kèm tiền mặt đưa trước): { tienMat, chuyenKhoan }; trả QR trọn hóa đơn hoặc
 * tiền mặt thường -> null (giữ nguyên cách hiển thị cũ). Phần chuyển khoản = số đã thu − tiền mặt.
 */
export function chiaThanhToanKetHop(result) {
  if (!result || result.phuongThuc !== "PAYOS") return null;
  const tienMat = tienMatTruocCua(result);
  if (!tienMat) return null;
  const daThu = Number(result.soTienThu);
  const tong = Number.isFinite(daThu) && daThu > 0 ? daThu : Number(result.tongCong) || 0;
  return { tienMat, chuyenKhoan: Math.max(0, tong - tienMat) };
}

/**
 * Khóa nhận diện một lần tạo mã QR có tiền mặt (kho, khách, dòng hàng, tiền mặt): lần trước lỗi chưa rõ (mất mạng,
 * máy chủ quá giờ) mà bấm lại với đúng khóa này thì dùng lại requestId cũ để máy chủ trả đúng mã đã tạo, không sinh
 * mã thứ hai mang cùng số tiền mặt.
 */
export function khoaTaoQrKemTienMat({ khoId, khachHangId, items }, tienMat) {
  return JSON.stringify([
    khoId ?? null,
    khachHangId ?? null,
    (items ?? []).map((item) => [item.bienTheSanPhamId, item.quantity, item.unitPriceClient]),
    tienMat,
  ]);
}

/** 30 giây cuối của mã QR: đồng hồ chuyển vàng, nhắc thu ngân khách chưa quét thì hủy mã, tạo mã mới. */
export const NHAC_SAP_HET_MS = 30000;

/**
 * Gắn giờ hết hạn theo đồng hồ máy quầy (hetHanMay, mili giây) cho mã QR máy chủ vừa trả: lấy khoảng còn lại theo giờ
 * máy chủ (hetHanLuc − gioMayChu) cộng vào giờ máy quầy lúc nhận. Đồng hồ máy quầy chạy nhanh / chậm thì đồng hồ mã
 * QR và việc tự hủy lúc 00:00 vẫn đúng giờ máy chủ (không hủy sớm khi khách đang chuyển). Thiếu giờ máy chủ -> giữ nguyên.
 */
export function ganGioHetHanMay(link, nowMay = Date.now()) {
  if (!link || typeof link !== "object") return link;
  const het = link.hetHanLuc ? Date.parse(link.hetHanLuc) : NaN;
  const mayChu = link.gioMayChu ? Date.parse(link.gioMayChu) : NaN;
  if (!Number.isFinite(het) || !Number.isFinite(mayChu)) return link;
  return { ...link, hetHanMay: nowMay + (het - mayChu) };
}

/** Giờ hết hạn của mã QR theo đồng hồ máy quầy (mili giây): ưu tiên hetHanMay, không có thì hetHanLuc; sai -> null. */
export function hetHanTheoMay(link) {
  if (Number.isFinite(link?.hetHanMay)) return link.hetHanMay;
  const het = link?.hetHanLuc ? Date.parse(link.hetHanLuc) : NaN;
  return Number.isFinite(het) ? het : null;
}

/** Số mili giây tới giờ hết hạn của mã QR (âm = đã quá); thiếu / sai giờ hết hạn -> null. */
export function msToiHetHan(link, now = Date.now()) {
  const het = hetHanTheoMay(link);
  return het == null ? null : het - now;
}

/**
 * Pha của mã QR đang chờ theo đồng hồ máy quầy: "cho"; "sapHet" (còn ≤ 30 giây); "hetGio" (đã về 00:00 mà máy chủ chưa
 * đóng mã: màn hình ẩn mã ngay, máy quầy tự hủy mã). Thiếu giờ hết hạn -> "cho". Mã không còn chờ -> null.
 */
export function phaMaQr(link, now = Date.now()) {
  if (link?.trangThai !== "PENDING") return null;
  const conLai = msToiHetHan(link, now);
  if (conLai == null) return "cho";
  if (conLai <= 0) return "hetGio";
  return conLai <= NHAC_SAP_HET_MS ? "sapHet" : "cho";
}

/**
 * Lỗi tạo mã QR chắc chắn chưa có mã: máy chủ trả lỗi nghiệp vụ (4xx), hoặc 502 kèm câu báo của chính máy chủ (payOS
 * từ chối, giao dịch đã đóng). Còn lại (mất mạng, 5xx của proxy / quá giờ) là chưa rõ mã đã được tạo hay chưa.
 * 409 QR_DANG_TAO (mã trước của hóa đơn đang được tạo / vừa quá hạn) và QR_TIEN_MAT_KHAC (mã đang chờ mang số tiền mặt
 * khác) cũng là chưa rõ: mã trước có thể vẫn thành, phải gửi lại đúng requestId đó chứ không tạo mã thứ hai.
 */
export function loiTaoQrChacChuaCoMa(error) {
  const status = error?.response?.status;
  if (status == null) return false;
  const ma = error?.response?.data?.data?.code;
  if (status === 409 && (ma === "QR_DANG_TAO" || ma === "QR_TIEN_MAT_KHAC")) return false;
  if (status < 500) return true;
  return status === 502 && Boolean(error?.response?.data?.message);
}
