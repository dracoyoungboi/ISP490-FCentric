import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái ĐƠN BÁN HÀNG (bảng don_ban_hang, loai_chung_tu = 'don_ban_hang') — nguồn tên duy nhất cho danh sách,
 * chi tiết và hóa đơn in, để một trạng thái chỉ có một tên trên toàn hệ thống.
 *
 * Mã 3 trước đây danh sách ghi "Đã xuất kho toàn bộ"; sau bản sửa luồng nhặt hàng không còn xuất một phần
 * nên thống nhất "Đã xuất kho" (báo cáo review bố cục danh sách 13/10, mục 5).
 * `tone` khớp tone của StatusBadge (giữ như đang dùng ở danh sách).
 */
export const DON_BAN_HANG_STATUS = {
    0: { label: "Nháp", tone: "warning" },
    1: { label: "Chờ xuất kho", tone: "info" },
    2: { label: "Đang xử lý xuất kho", tone: "info" },
    3: { label: "Đã xuất kho", tone: "warning" },
    4: { label: "Đã hủy", tone: "danger" },
    5: { label: "Hoàn thành", tone: "success" },
    6: { label: "Bị hoàn trả", tone: "danger" },
};

/**
 * Tab của trang danh sách (7 nhãn, R6): gộp 4 và 6 thành một tab; không gộp 2 với 3 vì là hai việc khác nhau
 * (đang nhặt hàng / đã xuất kho). Nhãn từng dòng vẫn tách. `ma` là giá trị trên đường dẫn `?trangThai=`.
 */
export const DON_BAN_HANG_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: null },
    { ma: "nhap", label: DON_BAN_HANG_STATUS[0].label, trangThai: [0] },
    { ma: "cho-xuat-kho", label: DON_BAN_HANG_STATUS[1].label, trangThai: [1] },
    { ma: "dang-xu-ly-xuat-kho", label: DON_BAN_HANG_STATUS[2].label, trangThai: [2] },
    { ma: "da-xuat-kho", label: DON_BAN_HANG_STATUS[3].label, trangThai: [3] },
    { ma: "hoan-thanh", label: DON_BAN_HANG_STATUS[5].label, trangThai: [5] },
    { ma: "da-huy-hoan-tra", label: "Đã hủy / hoàn trả", trangThai: [4, 6] },
];

export function getDonBanHangStatus(trangThai) {
    return DON_BAN_HANG_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
