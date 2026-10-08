/**
 * Định dạng ngày giờ DÙNG RIÊNG cho phiếu in — luôn 2 chữ số, ngày trước
 * giờ sau: "12/09/2026" và "12/09/2026 15:30" (không giây).
 * Không dùng formatDate/formatDateTime chung của app vì toLocaleString
 * ('vi-VN') ra "15:30:00 12/9/2026" (giờ trước, có giây, không đệm số 0) —
 * khó đọc trên chứng từ giấy. Giờ theo múi giờ của máy đang in.
 * Giá trị rỗng/không hợp lệ -> "—".
 */
const pad = (number) => String(number).padStart(2, "0");

const toDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** "12/09/2026" */
export function formatPrintDate(value) {
    const date = toDate(value);
    if (!date) return "—";
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "12/09/2026 15:30" */
export function formatPrintDateTime(value) {
    const date = toDate(value);
    if (!date) return "—";
    return `${formatPrintDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
