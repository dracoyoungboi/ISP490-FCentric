// Hằng số cho luồng xuất kho theo Pick List (NhatHangController: cho_nhat → dang_nhat → da_nhat → da_xuat / da_huy).

export const PICK_LIST_STATUS = {
  cho_nhat: { label: "Chờ nhặt", tone: "neutral" },
  dang_nhat: { label: "Đang nhặt", tone: "info" },
  da_nhat: { label: "Đã nhặt, chờ xuất", tone: "warning" },
  da_xuat: { label: "Đã xuất", tone: "success" },
  da_huy: { label: "Đã hủy", tone: "danger" },
  hoan_tat: { label: "Hoàn tất", tone: "success" },
  huy: { label: "Đã hủy", tone: "danger" },
};

export const PICK_LIST_STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "cho_nhat", label: "Chờ nhặt" },
  { value: "dang_nhat", label: "Đang nhặt" },
  { value: "da_nhat", label: "Đã nhặt, chờ xuất" },
  { value: "da_xuat", label: "Đã xuất" },
  { value: "da_huy", label: "Đã hủy" },
];

/** Pick List còn quét / phân công được. */
export const PICK_LIST_EDITABLE = ["cho_nhat", "dang_nhat"];

export function getPickListStatus(trangThai) {
  return PICK_LIST_STATUS[trangThai] ?? { label: trangThai || "Không xác định", tone: "neutral" };
}

export const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function formatQuantity(value) {
  const n = toNumber(value);
  return Number.isInteger(n) ? n.toLocaleString("vi-VN") : n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}
