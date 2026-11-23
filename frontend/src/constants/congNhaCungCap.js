/**
 * Nhãn trạng thái phía NHÀ CUNG CẤP trên cổng nhà cung cấp (khác tên trạng thái ở phần quản trị).
 * Khai báo bằng tên tiếng Việt; StatusBadge dịch lúc vẽ và tra nhóm màu, biểu tượng ở constants/trangThai.js.
 */

/** Kết quả báo giá (LichSuBaoGia.items[].ketQua) → nhãn. */
export const NHAN_KET_QUA_BAO_GIA = Object.freeze({
  CHO_BAO_GIA: "Chờ báo giá",
  CHO_KET_QUA: "Chờ kết quả",
  DUOC_CHAP_NHAN: "Được chấp nhận",
  KHONG_CHAP_NHAN: "Không chấp nhận",
  DA_HUY: "Đã hủy",
});

/** Hàng lỗi của biên bản đang ở đâu → nhãn (hàng còn ở kho thì theo lựa chọn của nhà cung cấp, xem nhanHangLoi). */
export const NHAN_HANG_LOI = Object.freeze({
  CHO_CHON: "Chờ bạn chọn",
  NHAN_LAI: "Ở kho chờ lấy",
  TIEU_HUY: "Chờ tiêu hủy",
  DA_TRA: "Đã trả",
  DA_TIEU_HUY: "Đã tiêu hủy",
});

/** Trạng thái biên bản trả hàng phía nhà cung cấp → nhãn ở đầu trang biên bản. */
export const NHAN_TRANG_THAI_BIEN_BAN = Object.freeze({
  CHO_XAC_NHAN: "Chờ bạn xác nhận",
  DA_XAC_NHAN: "Đã xác nhận",
  DA_HUY: "Đã hủy",
  // Chờ xác nhận nhưng không còn gì chọn được trên cổng (đơn mua đã kết thúc)
  HET_HAN_TRA_LOI: "Hết hạn",
});
