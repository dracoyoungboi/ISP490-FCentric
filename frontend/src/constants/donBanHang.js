import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái ĐƠN BÁN HÀNG (bảng don_ban_hang, loai_chung_tu = 'don_ban_hang') — nguồn tên duy nhất cho danh sách,
 * chi tiết, tìm kiếm toàn hệ thống và hóa đơn in, để một trạng thái chỉ có một tên trên toàn hệ thống.
 *
 * Luồng kho (khớp backend ITrangThaiDonBanHang, mã số dùng trong code ở constants/trangThaiXuatBan):
 *   0 Nháp → 1 Chờ nhặt hàng → 7 Chờ đóng gói → 8 Chờ xuất kho → 3 Đã xuất kho → 5 Hoàn thành
 *   (2 Đã xuất một phần, 4 Đã hủy, 6 Bị hoàn trả).
 * `tone` khớp tone của StatusBadge (giữ như đang dùng ở danh sách).
 */
export const DON_BAN_HANG_STATUS = {
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

/**
 * Tab của trang danh sách, theo thứ tự luồng nghiệp vụ: gộp 4 và 6 thành một tab; không gộp 2 với 3 vì là hai
 * việc khác nhau (còn hàng chưa xuất / đã xuất đủ). Nhãn từng dòng vẫn tách. `ma` là giá trị trên đường dẫn `?trangThai=`.
 */
export const DON_BAN_HANG_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: null },
    { ma: "nhap", label: DON_BAN_HANG_STATUS[0].label, trangThai: [0] },
    { ma: "cho-nhat-hang", label: DON_BAN_HANG_STATUS[1].label, trangThai: [1] },
    { ma: "cho-dong-goi", label: DON_BAN_HANG_STATUS[7].label, trangThai: [7] },
    { ma: "cho-xuat-kho", label: DON_BAN_HANG_STATUS[8].label, trangThai: [8] },
    { ma: "da-xuat-mot-phan", label: DON_BAN_HANG_STATUS[2].label, trangThai: [2] },
    { ma: "da-xuat-kho", label: DON_BAN_HANG_STATUS[3].label, trangThai: [3] },
    { ma: "hoan-thanh", label: DON_BAN_HANG_STATUS[5].label, trangThai: [5] },
    { ma: "da-huy-hoan-tra", label: "Đã hủy / hoàn trả", trangThai: [4, 6] },
];

export function getDonBanHangStatus(trangThai) {
    return DON_BAN_HANG_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
