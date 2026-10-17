// Hằng số cho luồng xuất kho theo Pick List (NhatHangController: cho_nhat → dang_nhat → da_nhat; da_huy).
// Nhặt xong thì đơn chuyển "Chờ đóng gói" (Scan-to-Pack); 'da_xuat' chỉ còn trong dữ liệu cũ chưa chạy dong_goi_v1.sql.
// Màu thẻ tra theo tên ở constants/trangThai.js.

export const PICK_LIST_STATUS = {
  cho_nhat: { label: "Chờ nhặt" },
  dang_nhat: { label: "Đang nhặt" },
  da_nhat: { label: "Đã nhặt" },
  da_xuat: { label: "Đã xuất" },
  da_huy: { label: "Đã hủy" },
  hoan_tat: { label: "Hoàn thành" },
  huy: { label: "Đã hủy" },
};

/**
 * Tab trạng thái của danh sách phiếu nhặt hàng (bố cục A+G): `ma` nằm trên URL ?trangThai=,
 * `trangThai` là mã gửi API (mỗi lần gọi một trạng thái). Nhãn lấy từ PICK_LIST_STATUS.
 * Không có tab 'da_xuat': phiếu nhặt kết thúc ở 'da_nhat' (dong_goi_v1.sql đã chuyển dữ liệu cũ).
 */
export const PICK_LIST_TABS = [
  { ma: "tat-ca", label: "Tất cả", trangThai: null },
  { ma: "cho-nhat", label: PICK_LIST_STATUS.cho_nhat.label, trangThai: "cho_nhat" },
  { ma: "dang-nhat", label: PICK_LIST_STATUS.dang_nhat.label, trangThai: "dang_nhat" },
  { ma: "da-nhat", label: PICK_LIST_STATUS.da_nhat.label, trangThai: "da_nhat" },
  { ma: "da-huy", label: PICK_LIST_STATUS.da_huy.label, trangThai: "da_huy" },
];

/** Pick List còn quét / phân công được. */
export const PICK_LIST_EDITABLE = ["cho_nhat", "dang_nhat"];

export function getPickListStatus(trangThai) {
  return PICK_LIST_STATUS[trangThai] ?? { label: trangThai ? `Không xác định (mã ${trangThai})` : "Chưa có trạng thái" };
}

export const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function formatQuantity(value) {
  const n = toNumber(value);
  return Number.isInteger(n) ? n.toLocaleString("vi-VN") : n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}
