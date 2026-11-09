import { t } from "../i18n/t.js";
// Họ tên người dùng (Hồ sơ của tôi, Thêm người dùng): chuẩn hóa cách viết rồi kiểm.
// Cùng luật với máy chủ (backend utils/HoTen.java); sửa một bên thì sửa cả bên kia.
// Chuẩn hóa (không báo lỗi): dấu tiếng Việt về một dạng (NFC), bỏ ký tự vô hình, gộp khoảng trắng, cắt hai đầu.
// Luật: bắt đầu bằng chữ cái; chỉ gồm chữ cái (có dấu), dấu cách và ' ’ . -; dài 2–100 ký tự (bằng cột ho_ten).
// Không bắt buộc 2 từ (người một tên, người nước ngoài) và không tự viết hoa.

export const HO_TEN_TOI_THIEU = 2;
export const HO_TEN_TOI_DA = 100;

// Cùng câu với máy chủ (hiện dưới ô nên giữ trong một dòng)
export const LOI_HO_TEN_TRONG = t("Nhập họ và tên");
export const LOI_HO_TEN_KY_TU = t("Họ tên chỉ gồm chữ cái và dấu cách");
export const LOI_HO_TEN_NGAN = t("Họ tên cần ít nhất {{toiThieu}} ký tự", { toiThieu: HO_TEN_TOI_THIEU });
export const LOI_HO_TEN_DAI = t("Họ tên tối đa {{toiDa}} ký tự", { toiDa: HO_TEN_TOI_DA });

// Ký tự vô hình hay dính khi dán (liệt kê tường minh như bienSoXe.js)
const VO_HINH = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
const KHOANG_TRANG = /[\s\p{Z}]+/gu;
// Cắt đúng dấu cách đã gộp ở hai đầu (như máy chủ; trim() của Java bỏ cả ký tự điều khiển, của JS thì không)
const KHOANG_HAI_DAU = /^ | $/g;
const HOP_LE = /^\p{L}[\p{L}\p{M} '’.-]*$/u;
// Chuỗi quá dài thì báo lỗi ngay, không chuẩn hóa
const DO_DAI_THO_TOI_DA = 1000;

/** null/undefined → "". */
export function chuanHoaHoTen(chuoi) {
    return String(chuoi ?? "")
        .normalize("NFC")
        .replace(VO_HINH, "")
        .replace(KHOANG_TRANG, " ")
        .replace(KHOANG_HAI_DAU, "");
}

/** Câu báo lỗi, hoặc "" khi hợp lệ. Nhận chuỗi chưa chuẩn hóa. */
export function loiHoTen(chuoi) {
    if (chuoi != null && String(chuoi).length > DO_DAI_THO_TOI_DA) return LOI_HO_TEN_DAI;
    const s = chuanHoaHoTen(chuoi);
    if (!s) return LOI_HO_TEN_TRONG;
    if (!HOP_LE.test(s)) return LOI_HO_TEN_KY_TU;
    // Đếm theo ký tự (code point) như máy chủ, không theo đơn vị UTF-16
    const doDai = [...s].length;
    if (doDai < HO_TEN_TOI_THIEU) return LOI_HO_TEN_NGAN;
    if (doDai > HO_TEN_TOI_DA) return LOI_HO_TEN_DAI;
    return "";
}
