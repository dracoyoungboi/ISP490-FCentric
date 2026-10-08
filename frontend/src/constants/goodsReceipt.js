/**
 * Trạng thái PHIẾU NHẬP KHO — nguồn DUY NHẤT cho danh sách, chi tiết và bản in
 * (trước đây mỗi trang tự khai báo nên cùng một phiếu hiện "Nháp" ở danh sách,
 * "Đang xử lý" ở chi tiết).
 *
 * Backend (enum TrangThaiPhieuNhap) thực tế chỉ dùng 3 trạng thái:
 * - 0: phiếu vừa tạo, đang khai báo lô, chờ xác nhận nhập kho
 * - 3: đã xác nhận nhập kho (tồn kho đã cộng)
 * - 4: đã huỷ
 * 1/2 (Chờ duyệt / Đã duyệt) có trong enum nhưng không có luồng nào gán —
 * chỉ giữ để hiển thị nếu gặp dữ liệu cũ, KHÔNG đưa vào bộ lọc.
 */
export const GOODS_RECEIPT_STATUS = {
    0: { label: "Chờ nhập kho", tone: "warning" },
    1: { label: "Chờ duyệt", tone: "info" },
    2: { label: "Đã duyệt", tone: "info" },
    3: { label: "Đã nhập kho", tone: "success" },
    4: { label: "Đã huỷ", tone: "danger" },
};

/** Trạng thái dùng cho bộ lọc danh sách — chỉ các trạng thái có thật. */
export const GOODS_RECEIPT_FILTER_STATUSES = [0, 3, 4];

export function getGoodsReceiptStatus(trangThai) {
    return GOODS_RECEIPT_STATUS[trangThai] ?? { label: "Không xác định", tone: "neutral" };
}

/**
 * Loại nhập hiển thị — cùng quy tắc với trang chi tiết phiếu nhập:
 * - có mã đơn mua            -> nhập từ đơn mua hàng (loaiNhap của backend)
 * - có phiếu xuất gốc        -> chuyển kho nội bộ / hoàn trả huỷ chuyển kho
 * - không có cả hai          -> nhập hoàn trả từ đơn bán (backend chưa phân
 *                               biệt nên trả nhầm "Chuyển kho nội bộ")
 */
export function getGoodsReceiptTypeLabel(detail) {
    const data = detail || {};
    const isSalesReturn = !data.soDonMua && !data.phieuXuatGocId;
    if (isSalesReturn) return "Nhập hoàn trả (Từ Đơn bán)";
    return data.loaiNhap || "Phiếu nhập kho";
}
