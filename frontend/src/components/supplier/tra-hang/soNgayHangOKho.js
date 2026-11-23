/** Hàng lỗi nằm ở kho quá số ngày này (tính từ lúc nhập kho) thì nhắc bằng chữ cam. */
export const SO_NGAY_NHAC_HANG_O_KHO = 7;
const MOT_NGAY_MS = 24 * 60 * 60 * 1000;

/**
 * Số ngày hàng lỗi của biên bản trả hàng đã nằm ở kho, chỉ khi quá SO_NGAY_NHAC_HANG_O_KHO; còn lại null.
 * `luc`: thời điểm tải danh sách (ms), để số ngày không đổi mỗi lần vẽ lại.
 */
export function soNgayHangOKho(bienBan, luc) {
  if (bienBan?.trangThaiHang !== "O_KHO" || bienBan?.trangThaiHienThi === "DA_HUY" || !bienBan?.ngayNhapKho || !luc) {
    return null;
  }
  const ngay = Math.floor((luc - new Date(bienBan.ngayNhapKho).getTime()) / MOT_NGAY_MS);
  return ngay > SO_NGAY_NHAC_HANG_O_KHO ? ngay : null;
}
