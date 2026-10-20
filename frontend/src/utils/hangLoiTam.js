/**
 * Lưu tạm trong phiên trình duyệt (sessionStorage) lô đang kiểm chưa khóa của màn Kiểm đếm & khóa lô:
 * các lượt quét, kệ, mã lô, ngày sản xuất. Tải lại trang không mất số đã quét và vẫn hoàn tác được từng lượt.
 * Đóng thẻ trình duyệt là mất (lô chưa khóa chưa được lưu máy chủ).
 *
 * Hàng không đạt của lô ĐÃ KHÓA không còn lưu ở đây: máy chủ lưu theo lô (chi_tiet_loi_lo_hang),
 * màn chi tiết phiếu và biên bản trả hàng đọc từ máy chủ.
 */
const KHOA_LOI_CU = (phieuId) => `fcentric:hang-loi:${phieuId}`;
const KHOA_LO_DANG_KIEM = (phieuId, bienTheId) => `fcentric:lo-dang-kiem:${phieuId}:${bienTheId}`;

function doc(khoa, macDinh) {
  try {
    const raw = window.sessionStorage.getItem(khoa);
    return raw ? JSON.parse(raw) : macDinh;
  } catch {
    return macDinh;
  }
}

function ghi(khoa, giaTri) {
  try {
    if (giaTri == null) window.sessionStorage.removeItem(khoa);
    else window.sessionStorage.setItem(khoa, JSON.stringify(giaTri));
  } catch {
    // Trình duyệt chặn bộ nhớ phiên: vẫn chạy, chỉ không giữ được khi tải lại trang
  }
}

/** Phiên kiểm của lô đang kiểm (xem pages/receipt/kiemDem.js) hoặc null. */
export function docLoDangKiem(phieuId, bienTheId) {
  return doc(KHOA_LO_DANG_KIEM(phieuId, bienTheId), null);
}

/** Ghi lô đang kiểm; null để xóa (khóa lô xong hoặc phiếu không còn kiểm đếm). */
export function ghiLoDangKiem(phieuId, bienTheId, phien) {
  ghi(KHOA_LO_DANG_KIEM(phieuId, bienTheId), phien);
}

/** Dọn bản hàng lỗi tạm của bản cũ (trước khi máy chủ lưu hàng lỗi theo lô). */
export function xoaHangLoiTamCu(phieuId) {
  ghi(KHOA_LOI_CU(phieuId), null);
}

/**
 * Số lượt quét chưa khóa lô (chưa hoàn tác) của mọi lô đang kiểm trong phiên trình duyệt này.
 * Đăng xuất xóa bộ nhớ phiên: còn lượt thì phải hỏi lại trước, không để mất số đã đếm lặng lẽ.
 */
export function demLuotChuaKhoa() {
  try {
    const kho = window.sessionStorage;
    let dem = 0;
    for (let i = 0; i < kho.length; i++) {
      const khoa = kho.key(i);
      if (!khoa || !khoa.startsWith("fcentric:lo-dang-kiem:")) continue;
      const phien = doc(khoa, null);
      dem += Array.isArray(phien?.log) ? phien.log.filter((e) => e && !e.huy).length : 0;
    }
    return dem;
  } catch {
    return 0;
  }
}
