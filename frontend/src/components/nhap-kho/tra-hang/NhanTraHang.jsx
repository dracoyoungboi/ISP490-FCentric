import StatusBadge from "@/components/shared/StatusBadge";
import { TRANG_THAI_HANG_LOI, trangThaiTraHang } from "@/constants/nhapKho";

/*
 * Thẻ trạng thái của biên bản trả hàng nhà cung cấp, vẽ bằng StatusBadge dùng chung (nhóm màu và vòng tiến trình
 * khai báo ở constants/trangThai.js, quy trình "traHangNcc") để cùng kiểu với Đơn mua hàng, Phiếu nhập kho.
 */

/** Trạng thái biên bản (Chưa nhập kho, Chờ nhà cung cấp xác nhận, Chờ giao trả hàng, Chờ tiêu hủy…). */
export function NhanTrangThaiTraHang({ ma, className }) {
  return <StatusBadge quyTrinh="traHangNcc" label={trangThaiTraHang(ma).label} className={className} />;
}

/**
 * Trạng thái hàng lỗi (Đang ở kho chờ trả: cam vì kho còn phải làm; Đã giao trả / Đã tiêu hủy: xanh lá), dùng ở hộp
 * xem biên bản. Danh sách không dùng thẻ này: chỉ cột Trạng thái có thẻ màu.
 */
export function NhanTrangThaiHangLoi({ ma, className }) {
  const nhan = TRANG_THAI_HANG_LOI[ma]?.label ?? ma;
  return nhan ? <StatusBadge label={nhan} className={className} /> : null;
}
