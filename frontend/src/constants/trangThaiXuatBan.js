/*
 * Mã trạng thái luồng xuất bán — khớp backend (ITrangThaiDonBanHang, ITrangThaiPhieuXuat). Dùng để so sánh trong code;
 * TÊN hiển thị nằm ở constants/donBanHang và constants/phieuXuatKho (một trạng thái chỉ có một tên).
 * Đơn bán:  0 Nháp → 1 Chờ nhặt hàng → 7 Chờ đóng gói → 8 Chờ xuất kho → 3 Đã xuất kho → 5 Hoàn thành
 *           (2 Đã xuất một phần, 4 Đã hủy, 6 Bị hoàn trả)
 * Phiếu xuất bán hàng: 0 Nháp (chờ đóng gói) → 6 Chờ xuất (đã đóng gói) → 3 Đã xuất; 4 Đã hủy.
 * Phiếu yêu cầu chuyển kho dùng thêm 1 Chờ duyệt, 2 Đã duyệt.
 */

export const TRANG_THAI_DON = {
  NHAP: 0,
  CHO_NHAT_HANG: 1,
  DA_XUAT_MOT_PHAN: 2,
  DA_XUAT_KHO: 3,
  DA_HUY: 4,
  HOAN_THANH: 5,
  BI_HOAN_TRA: 6,
  CHO_DONG_GOI: 7,
  CHO_XUAT_KHO: 8,
};

export const TRANG_THAI_PHIEU_XUAT = {
  NHAP: 0,
  CHO_DUYET: 1,
  DA_DUYET: 2,
  DA_XUAT: 3,
  DA_HUY: 4,
  CHO_XUAT: 6,
};

/** Phiếu xuất chưa xuất kho (còn chọn lô / hủy được). */
export const PHIEU_XUAT_CHUA_XUAT = [0, 1, 2, 6];
