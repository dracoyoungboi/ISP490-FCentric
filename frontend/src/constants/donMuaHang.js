import { trangThaiLa } from "@/constants/trangThaiChung";

/**
 * Trạng thái ĐƠN MUA HÀNG (bảng don_mua_hang) — nguồn tên duy nhất cho danh sách, chi tiết và bản in
 * đơn mua hàng, để một trạng thái chỉ có một tên (bố cục A+G, mục 2 đặc tả).
 *
 * - Trang Đơn mua hàng chỉ lấy 3 và 5. Mã 3 chỉ một tên "Đang vận chuyển" (bỏ "Chờ vận chuyển").
 * - 0, 1, 2, 4 giữ đúng tên bản in đơn mua hàng đang dùng. Các màn báo giá (QuotationDetail, bảng báo giá
 *   ở Yêu cầu báo giá, bản in yêu cầu báo giá) đang gọi cùng mã bằng tên khác — chờ chốt, chưa gộp.
 * - Hệ thống chưa có trạng thái "đã nhập kho" cho đơn mua (C6): đơn đã nhập kho vẫn ở 3 hoặc 5.
 * - Mã 5 hiện "Đã nhận đủ": thanh toán nhà cung cấp đã bỏ khỏi hệ thống (đổi tên ngày 17/10, trước là "Đã thanh toán").
 * Màu thẻ tra theo tên ở constants/trangThai.js.
 */
export const DON_MUA_HANG_STATUS = {
    0: { label: "Đã xóa" },
    1: { label: "Đã gửi" },
    2: { label: "Đã báo giá" },
    3: { label: "Đang vận chuyển" },
    4: { label: "Không chấp nhận báo giá" },
    5: { label: "Đã nhận đủ" },
};

/**
 * Tab của trang Đơn mua hàng: "Tất cả" vẫn chỉ gồm 3 và 5 như trang đang lọc.
 * `ma` là giá trị trên đường dẫn `?trangThai=`.
 */
export const DON_MUA_HANG_TABS = [
    { ma: "tat-ca", label: "Tất cả", trangThai: [3, 5] },
    { ma: "dang-van-chuyen", label: DON_MUA_HANG_STATUS[3].label, trangThai: [3] },
    { ma: "da-nhan-du", label: DON_MUA_HANG_STATUS[5].label, trangThai: [5] },
];

/** Mã tab cũ trên đường dẫn (trước khi bỏ thanh toán đơn mua, K8) → mã mới: đường dẫn đã lưu vẫn mở đúng tab. */
export const DON_MUA_HANG_TAB_CU = { "da-thanh-toan": "da-nhan-du" };

export function getDonMuaHangStatus(trangThai) {
    return DON_MUA_HANG_STATUS[trangThai] ?? trangThaiLa(trangThai);
}

/**
 * Cùng bảng don_mua_hang nhưng xem như BÁO GIÁ NHÀ CUNG CẤP (màn Yêu cầu báo giá, chi tiết báo giá,
 * bản in yêu cầu báo giá): các màn này gọi mã 1–3 theo bước báo giá. Trước đây mỗi màn tự khai báo một bảng
 * riêng; nay dùng chung bảng này. Mã 4, 5 dùng cùng tên với DON_MUA_HANG_STATUS.
 */
export const BAO_GIA_NCC_STATUS = {
    0: { label: "Đã xóa" },
    1: { label: "Đã gửi YC báo giá" },
    2: { label: "Đã nhận báo giá" },
    3: { label: "Đã chuyển thành đơn mua hàng" },
    // K1: báo giá không được chọn (không ai từ chối) cũng ở 4 nên dùng chung nhãn "Không chấp nhận báo giá", không gọi
    // là "Từ chối" (đặc tả K1, TICH-HOP 1)
    4: { label: DON_MUA_HANG_STATUS[4].label },
    5: { label: DON_MUA_HANG_STATUS[5].label },
};

export function getBaoGiaNccStatus(trangThai) {
    return BAO_GIA_NCC_STATUS[trangThai] ?? trangThaiLa(trangThai);
}
