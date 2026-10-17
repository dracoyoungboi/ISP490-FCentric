import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái BÁO GIÁ BÁN (bảng don_ban_hang, loai_chung_tu = 'bao_gia') — nguồn tên duy nhất cho danh sách,
 * chi tiết và bản in, để một trạng thái chỉ có một tên trên toàn hệ thống.
 *
 * Backend chỉ gán 3 mã: 0 khi tạo (hoặc khi đơn sinh từ báo giá bị hủy), 2 khi chốt thành đơn bán hàng,
 * 4 khi khách từ chối. Mã 0 trước đây trang chi tiết và bản in ghi "Đang chờ phản hồi"; nay dùng tên của danh sách.
 * Màu thẻ tra theo tên ở constants/trangThai.js.
 */
export const BAO_GIA_STATUS = {
    0: { label: "Chờ phản hồi" },
    2: { label: "Đã chốt đơn" },
    4: { label: "Bị từ chối" },
};

/**
 * Tab của trang danh sách báo giá. `ma` là giá trị trên đường dẫn `?trangThai=`.
 */
export const BAO_GIA_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: null },
    { ma: "cho-phan-hoi", label: BAO_GIA_STATUS[0].label, trangThai: [0] },
    { ma: "da-chot-don", label: BAO_GIA_STATUS[2].label, trangThai: [2] },
    { ma: "bi-tu-choi", label: BAO_GIA_STATUS[4].label, trangThai: [4] },
];

export function getBaoGiaStatus(trangThai) {
    return BAO_GIA_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
