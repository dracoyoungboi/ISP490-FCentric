import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái PHIẾU XUẤT KHO (phiếu xuất bán hàng và phiếu xuất chuyển kho) — nguồn tên duy nhất
 * cho danh sách, chi tiết, trang xem và bản in, để một trạng thái chỉ có một tên trên toàn hệ thống.
 *
 * Với hai loại phiếu này backend dùng:
 * - 0: phiếu vừa tạo, đang nhặt lô, chờ xuất kho (trước đây ghi "Nháp")
 * - 2: đã thu hồi — đơn bán bị hủy (trên sàn hoặc trong đợt nhặt) khi phiếu còn chờ xuất
 * - 3: đã xuất kho (tồn kho đã trừ)
 * - 4: đã hủy
 * 1 chỉ được gán cho phiếu chuyển kho loại `khac` (trang Chuyển kho nội bộ, có bảng tên riêng); 5 không
 * xảy ra với hai loại phiếu này. Vẫn giữ nhãn để hiện nếu gặp, KHÔNG đưa vào tab của danh sách.
 * Mã lạ (dữ liệu cũ / ghi từ phiên bản khác) hiện "Không xác định (mã N)" hoặc "Chưa có trạng thái".
 * `tone` khớp tone của StatusBadge (giữ như đang dùng ở danh sách).
 */
export const PHIEU_XUAT_KHO_STATUS = {
    0: { label: "Chờ xuất kho", tone: "warning" },
    1: { label: "Chờ duyệt", tone: "info" },
    // 2 với phiếu bán hàng = thu hồi do đơn bị hủy khi phiếu còn chờ xuất
    // (NhatHangServiceImpl, OmnichannelOrderSyncJob: "2: Đã hủy / Thu hồi")
    2: { label: "Đã thu hồi", tone: "danger" },
    3: { label: "Đã xuất", tone: "success" },
    4: { label: "Đã hủy", tone: "danger" },
    5: { label: "Đã xuất", tone: "success" },
};

/**
 * Tab của trang danh sách. `ma` là giá trị trên đường dẫn `?trangThai=`.
 * API danh sách chỉ nhận MỘT trạng thái: tab "Đã xuất" lọc mã 3 (mã 5 không xảy ra với hai loại phiếu này).
 */
export const PHIEU_XUAT_KHO_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: null },
    { ma: "cho-xuat-kho", label: "Chờ xuất kho", trangThai: 0 },
    { ma: "da-xuat", label: "Đã xuất", trangThai: 3 },
    { ma: "da-huy", label: "Đã hủy", trangThai: 4 },
    { ma: "da-thu-hoi", label: "Đã thu hồi", trangThai: 2 },
];

export function getPhieuXuatKhoStatus(trangThai) {
    return PHIEU_XUAT_KHO_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
