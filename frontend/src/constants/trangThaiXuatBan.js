/*
 * Trạng thái luồng xuất bán — khớp backend (ITrangThaiDonBanHang, ITrangThaiPhieuXuat). Dùng chung cho mọi màn
 * để nhãn không lệch nhau.
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

export const DON_BAN_STATUS = {
  0: { label: "Nháp", tone: "warning" },
  1: { label: "Chờ nhặt hàng", tone: "info" },
  2: { label: "Đã xuất một phần", tone: "info" },
  3: { label: "Đã xuất kho", tone: "warning" },
  4: { label: "Đã hủy", tone: "danger" },
  5: { label: "Hoàn thành", tone: "success" },
  6: { label: "Bị hoàn trả", tone: "danger" },
  7: { label: "Chờ đóng gói", tone: "info" },
  8: { label: "Chờ xuất kho", tone: "info" },
};

/** Thứ tự hiển thị theo luồng nghiệp vụ (khóa số trong object tự sắp theo số nên không dùng Object.keys). */
export const DON_BAN_STATUS_ORDER = [0, 1, 7, 8, 2, 3, 5, 4, 6];

/** Đơn đang được kho xử lý (đã gửi kho, chưa xuất hết, chưa hủy). */
export const DON_DANG_O_KHO = [1, 2, 7, 8];

export const TRANG_THAI_PHIEU_XUAT = {
  NHAP: 0,
  CHO_DUYET: 1,
  DA_DUYET: 2,
  DA_XUAT: 3,
  DA_HUY: 4,
  CHO_XUAT: 6,
};

export const PHIEU_XUAT_STATUS = {
  0: { label: "Nháp", tone: "warning" },
  1: { label: "Chờ duyệt", tone: "info" },
  2: { label: "Đã duyệt", tone: "info", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  3: { label: "Đã xuất", tone: "success" },
  4: { label: "Đã hủy", tone: "danger" },
  5: { label: "Đã xuất", tone: "success" },
  6: { label: "Chờ xuất", tone: "info", className: "border-sky-200 bg-sky-50 text-sky-700" },
};

/** Phiếu xuất chưa xuất kho (còn chọn lô / hủy được). */
export const PHIEU_XUAT_CHUA_XUAT = [0, 1, 2, 6];

export function getDonBanStatus(trangThai) {
  return DON_BAN_STATUS[trangThai] ?? { label: "Không xác định", tone: "neutral" };
}

export function getPhieuXuatStatus(trangThai) {
  return PHIEU_XUAT_STATUS[trangThai] ?? { label: "Không xác định", tone: "neutral" };
}
