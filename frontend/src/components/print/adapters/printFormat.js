/**
 * Định dạng DÙNG RIÊNG cho phiếu in (ngày, số lượng, tiền) — một nguồn cho mọi
 * adapter để mọi chứng từ ghi cùng một kiểu:
 * - ngày: "12/09/2026";
 * - ngày đầu phiếu: "Ngày 12 tháng 09 năm 2026" (kiểu chứng từ Việt Nam);
 * - số lượng / tiền: phân nhóm nghìn bằng dấu chấm theo vi-VN, tiền thêm " ₫".
 * Giờ theo múi giờ của máy đang in. Giá trị rỗng/không hợp lệ -> "—".
 *
 * Không import "@/…" để chạy được bằng `node --test`.
 */
const pad = (number) => String(number).padStart(2, "0");

// Chuỗi chỉ có ngày ("2026-09-20", kiểu LocalDate) là ngày THEO LỊCH, không
// phải mốc giờ UTC: new Date("2026-09-20") hiểu là 00:00 UTC nên ở múi giờ âm
// sẽ lùi về 19/09. Đọc thành ngày địa phương để không bao giờ lệch ngày.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const toDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "string") {
        const match = DATE_ONLY.exec(value.trim());
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** "12/09/2026" */
export function formatPrintDate(value) {
    const date = toDate(value);
    if (!date) return "—";
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "Ngày 12 tháng 09 năm 2026" — dòng ngày lập dưới tên chứng từ. Rỗng -> null (ẩn dòng). */
export function formatPrintLongDate(value) {
    const date = toDate(value);
    if (!date) return null;
    return `Ngày ${pad(date.getDate())} tháng ${pad(date.getMonth() + 1)} năm ${date.getFullYear()}`;
}

/** Số gốc để tính tổng — null khi thiếu, KHÔNG nhầm với 0. */
export const toNumeric = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const NUMBER = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const MONEY = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** "1.250" — null/không hợp lệ -> "—". */
export function formatPrintNumber(value) {
    const number = toNumeric(value);
    return number === null ? "—" : NUMBER.format(number);
}

/** "1.250.000 ₫" (làm tròn đến đồng) — null/không hợp lệ -> "—". */
export function formatPrintMoney(value) {
    const number = toNumeric(value);
    return number === null ? "—" : `${MONEY.format(Math.round(number))} ₫`;
}

/** Giá trị chữ: cắt khoảng trắng, rỗng -> "—". */
export const dash = (value) => {
    if (value === null || value === undefined) return "—";
    const text = String(value).trim();
    return text === "" ? "—" : text;
};

/** Như dash nhưng rỗng -> null: trường KHÔNG áp dụng / không có dữ liệu thì ẩn hẳn trên giấy. */
export const textOrNull = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text === "" ? null : text;
};

/** Nối các phần có giá trị bằng " · " — không phần nào có thì null. */
export const joinParts = (parts, separator = " · ") => {
    const kept = parts.map(textOrNull).filter(Boolean);
    return kept.length > 0 ? kept.join(separator) : null;
};
