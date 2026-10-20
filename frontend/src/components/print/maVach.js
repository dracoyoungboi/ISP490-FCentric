/**
 * Mã của SỐ PHIẾU in trên chứng từ (mã vạch Code 128 hoặc mã QR) — máy quét đọc ra đúng số phiếu,
 * quét vào ô tìm kiếm để tra nhanh chứng từ khi kiểm đếm, đối chiếu.
 *
 * Mã vạch mã hóa ĐỒNG BỘ (không cần DOM) bằng bộ mã Code 128 của jsbarcode, nên cùng một DOM cho
 * bản xem trước, bản in trình duyệt và bản dựng phía máy chủ/kiểm thử.
 */
import { CODE128 } from "jsbarcode/bin/barcodes/CODE128/index.js";

/** Số phiếu "không có" do adapter trả về. */
const isMissing = (value) => value === null || value === undefined || String(value).trim() === "" || value === "—";

/**
 * Chuỗi đưa vào mã: bỏ dấu tiếng Việt (Code 128 chỉ có ASCII), bỏ ký tự không in được và khoảng
 * trắng đầu/cuối. Số phiếu của hệ thống vốn là ASCII (PNK-0001, SO2026…) nên thường giữ nguyên.
 * Trả null khi không còn gì để mã hóa.
 */
export function toBarcodeText(value) {
    if (isMissing(value)) return null;
    const ascii = String(value)
        .replace(/[\u2010-\u2015\u2212]/g, "-")
        .replace(/[\u00A0\u2007\u202F]/g, " ")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^\x20-\x7E]/g, "")
        .trim();
    return ascii || null;
}

/**
 * Dãy vạch Code 128 ("1" = vạch đen, "0" = khoảng trắng; mỗi ký tự là một mô-đun) của một chuỗi,
 * hoặc null nếu không mã hóa được. Bộ mã tự chọn tập A/B/C (dãy số dài được nén đôi).
 */
export function encodeCode128(value) {
    const text = toBarcodeText(value);
    if (!text) return null;
    try {
        const barcode = new CODE128(text, {});
        if (!barcode.valid()) return null;
        const encoded = barcode.encode();
        const bits = Array.isArray(encoded) ? encoded.map((part) => part.data).join("") : encoded?.data;
        return typeof bits === "string" && /^[01]+$/.test(bits) ? bits : null;
    } catch {
        return null;
    }
}

/** Các vạch đen liền nhau của dãy mô-đun: [{ x, width }] tính theo mô-đun. */
export function barsFromBits(bits) {
    const bars = [];
    if (!bits) return bars;
    let start = -1;
    for (let index = 0; index <= bits.length; index += 1) {
        const on = bits[index] === "1";
        if (on && start < 0) start = index;
        if (!on && start >= 0) {
            bars.push({ x: start, width: index - start });
            start = -1;
        }
    }
    return bars;
}

/**
 * Chuỗi đưa vào mã QR: đúng số phiếu (QR chứa được chữ có dấu), chỉ bỏ ký tự điều khiển và khoảng
 * trắng đầu/cuối. null nếu không có số phiếu.
 */
export function toQrText(value) {
    if (isMissing(value)) return null;
    // eslint-disable-next-line no-control-regex
    const text = String(value).replace(/[\u0000-\u001F\u007F]/g, "").trim();
    return text || null;
}
