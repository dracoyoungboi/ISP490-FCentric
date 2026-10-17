import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái PHIẾU XUẤT KHO (phiếu xuất bán hàng và phiếu xuất chuyển kho) — nguồn tên duy nhất
 * cho danh sách, chi tiết, trang xem, màn đóng gói và bản in, để một trạng thái chỉ có một tên trên toàn hệ thống.
 *
 * Khớp backend ITrangThaiPhieuXuat (mã số dùng trong code ở constants/trangThaiXuatBan):
 * - Phiếu bán hàng: 0 Nháp (chờ đóng gói) → 6 Chờ xuất (đã đóng gói) → 3 Đã xuất; 4 Đã hủy (kể cả thu hồi
 *   khi đơn bị hủy — dữ liệu cũ ghi 2 được Database/sua_phieu_xuat_thu_hoi_v1.sql chuyển về 4).
 * - Phiếu chuyển kho xuất thẳng từ 0 Nháp. 1 Chờ duyệt / 2 Đã duyệt chỉ dành cho yêu cầu chuyển kho loại `khac`
 *   (trang Chuyển kho nội bộ, có bảng tên riêng); 5 không xảy ra với hai loại phiếu này. Vẫn giữ nhãn để hiện
 *   nếu gặp, KHÔNG đưa vào tab của danh sách.
 * Mã lạ (dữ liệu cũ / ghi từ phiên bản khác) hiện "Không xác định (mã N)" hoặc "Chưa có trạng thái".
 * Màu thẻ tra theo tên ở constants/trangThai.js.
 */
export const PHIEU_XUAT_KHO_STATUS = {
    0: { label: "Nháp" },
    1: { label: "Chờ duyệt" },
    2: { label: "Đã duyệt" },
    3: { label: "Đã xuất" },
    4: { label: "Đã hủy" },
    5: { label: "Đã xuất" },
    6: { label: "Chờ xuất" },
};

/**
 * Tab của trang danh sách. `ma` là giá trị trên đường dẫn `?trangThai=`.
 * API danh sách chỉ nhận MỘT trạng thái: tab "Đã xuất" lọc mã 3 (mã 5 không xảy ra với hai loại phiếu này).
 * "cho-xuat-kho" = phiếu đã đóng gói, chờ xác nhận xuất kho (mã 6).
 */
export const PHIEU_XUAT_KHO_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: null },
    { ma: "nhap", label: "Nháp", trangThai: 0 },
    { ma: "cho-xuat-kho", label: "Chờ xuất", trangThai: 6 },
    { ma: "da-xuat", label: "Đã xuất", trangThai: 3 },
    { ma: "da-huy", label: "Đã hủy", trangThai: 4 },
];

export function getPhieuXuatKhoStatus(trangThai) {
    return PHIEU_XUAT_KHO_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
