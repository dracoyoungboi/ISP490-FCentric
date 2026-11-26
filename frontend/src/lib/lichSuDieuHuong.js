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

/** Đường dẫn thuộc trung tâm Cấu hình (kể cả trình sửa mẫu in /settings/print-templates/:loai nằm ngoài khung Cấu hình). */
export function laDuongDanCauHinh(pathname) {
  return pathname === "/settings" || (typeof pathname === "string" && pathname.startsWith("/settings/"));
}

/**
 * Nút X của Cấu hình lùi bao nhiêu bước để về trang đứng trước khi vào Cấu hình.
 * `daLuu`: { idx, path } của trang ngoài Cấu hình xem gần nhất trong thẻ này (ghi ở sessionStorage nên còn sau F5,
 * sau khi ra vào trình sửa mẫu in); `state`: `window.history.state` của mục đang xem.
 * Trả số âm (đưa cho navigate) khi trang đó nằm phía trước trong lịch sử; null thì mở thẳng `daLuu.path`
 * (hoặc Tổng quan) — vd. vừa quay lại Cấu hình bằng Back sau khi sang trang khác, hay không đọc được `idx`.
 */
export function buocVeTruocCauHinh(daLuu, state) {
  if (!Number.isInteger(daLuu?.idx) || daLuu.idx < 0 || !Number.isInteger(state?.idx)) return null;
  return daLuu.idx < state.idx ? daLuu.idx - state.idx : null;
}
