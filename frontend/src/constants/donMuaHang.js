import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái ĐƠN MUA HÀNG (bảng don_mua_hang) — nguồn tên duy nhất cho danh sách, chi tiết và bản in
 * đơn mua hàng, để một trạng thái chỉ có một tên (bố cục A+G, mục 2 đặc tả).
 *
 * - Trang Đơn mua hàng chỉ lấy 3 và 5. Mã 3 chỉ một tên "Đang vận chuyển" (bỏ "Chờ vận chuyển").
 * - 0, 1, 2, 4 giữ đúng tên bản in đơn mua hàng đang dùng. Các màn báo giá (QuotationDetail, bảng báo giá
 *   ở Yêu cầu báo giá, bản in yêu cầu báo giá) đang gọi cùng mã bằng tên khác — chờ chốt, chưa gộp.
 * - Hệ thống chưa có trạng thái "đã nhập kho" cho đơn mua (C6): đơn đã nhập kho vẫn ở 3 hoặc 5.
 * `tone` khớp tone của StatusBadge (giữ như đang dùng ở danh sách, chi tiết, bản in).
 */
export const DON_MUA_HANG_STATUS = {
    0: { label: "Đã xóa", tone: "danger" },
    1: { label: "Đã gửi", tone: "info" },
    2: { label: "Đã báo giá", tone: "info" },
    3: { label: "Đang vận chuyển", tone: "warning" },
    4: { label: "Không chấp nhận báo giá", tone: "danger" },
    5: { label: "Đã thanh toán", tone: "success" },
};

/**
 * Tab của trang Đơn mua hàng: "Tất cả" vẫn chỉ gồm 3 và 5 như trang đang lọc.
 * `ma` là giá trị trên đường dẫn `?trangThai=`.
 */
export const DON_MUA_HANG_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: [3, 5] },
    { ma: "dang-van-chuyen", label: DON_MUA_HANG_STATUS[3].label, trangThai: [3] },
    { ma: "da-thanh-toan", label: DON_MUA_HANG_STATUS[5].label, trangThai: [5] },
];

export function getDonMuaHangStatus(trangThai) {
    return DON_MUA_HANG_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
