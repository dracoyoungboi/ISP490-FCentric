// Lịch sử điều hướng trong thẻ trình duyệt hiện tại — hàm thuần, không phụ thuộc React (chạy được với node --test).

/**
 * Trong thẻ này đã có trang trước của ứng dụng chưa, để nút Quay lại lùi một bước thay vì rời ứng dụng.
 * Truyền vào `window.history.state`.
 *
 * React Router ghi chỉ số `idx` vào `history.state` của mỗi mục lịch sử nó tạo: mục đầu tiên của mỗi lần
 * tải trang (mở thẳng bằng đường dẫn, thẻ mới, gõ URL, đi từ trang ngoài vào) là 0, mỗi lần chuyển trang
 * (push) +1, thay đường dẫn tại chỗ (replace: đổi tab qua useTabTrenUrl, <Navigate replace> của đường dẫn cũ)
 * giữ nguyên; F5 giữ nguyên.
 * Không dùng `location.key === "default"`: replace sinh key mới nên mục đầu tiên mất key "default".
 * `idx` là chi tiết nội bộ của React Router (có từ v6 đến 7.18): không đọc được thì coi như mở thẳng.
 */
export function coTrangTruocTrongUngDung(state) {
  return Number.isInteger(state?.idx) && state.idx > 0;
}
