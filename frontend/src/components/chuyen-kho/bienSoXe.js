/*
 * Biển số xe Việt Nam ở hộp Xác nhận xuất: chuẩn hóa cách viết và kiểm theo Thông tư 79/2024/TT-BCA (Điều 37 cấu trúc
 * biển, Điều 39 biển cũ còn lưu thông) và Phụ lục 02 Thông tư 51/2025/TT-BCA (ký hiệu địa phương). Cùng luật với máy chủ
 * (backend utils/BienSoXe.java); sửa một bên thì sửa cả bên kia và bộ ca thử ở hai phía. loiKhiDangGo chỉ có ở giao diện.
 * Chạy thử: node --test src/components/chuyen-kho/bienSoXe.test.js
 */

/** Ký hiệu địa phương (2 số đầu) theo Phụ lục 02 Thông tư 51/2025/TT-BCA, gồm 80 của Cục CSGT. */
export const MA_DIA_PHUONG_BIEN_SO = new Set(
    ("11 12 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 43 47 48 49 50 51 52 53 54 "
        + "55 56 57 58 59 60 61 62 63 64 65 66 67 68 69 70 71 72 73 74 75 76 77 78 79 80 81 82 83 84 85 86 88 89 90 92 93 94 "
        + "95 97 98 99").split(" "),
);

// 20 chữ cái sê ri (Điều 37 khoản 5 điểm c): không có I, J, O, Q, R, W
const CHU = "[ABCDEFGHKLMNPSTUVXYZ]";
// Chữ thứ hai sê ri xe máy: điểm d là 20 chữ trên, Phụ lục 04 mục 2.1.3 lại có R → nhận cả R
const CHU_2 = "[ABCDEFGHKLMNPRSTUVXYZ]";
// Sê ri 2 chữ của ô tô đang cấp (điểm e) và sê ri cũ còn lưu thông (Điều 39 khoản 1, 3)
const SERI_O_TO_RIENG = ["KT", "RM", "CD", "HC", "LD", "DA", "TĐ", "MK", "CT", "LB", "R"];
// Dấu ngăn được bỏ, gõ thì phải đúng chỗ: ô tô "30A-123.45" không có gạch sau 2 số đầu (gạch ở đó là cách viết xe máy)
const SO = String.raw`(\d{3})[. ]?(\d{2})|(\d{4})`;
const RE_O_TO = new RegExp(String.raw`^(\d{2}) ?(${CHU}|${SERI_O_TO_RIENG.join("|")})[- ]?(?:${SO})$`, "u");
const RE_XE_MAY = new RegExp(String.raw`^(\d{2})[- ]?(${CHU}[1-9]|${CHU}${CHU_2}|MĐ[1-9]|MK[1-9])[- ]?(?:${SO})$`, "u");
const RE_TAM_THOI = /^T ?(\d{2})[- ]?(\d{3})[. ]?(\d{2})$/u;
const RE_MD = /^(\d{2}[- ]?)MD(?=[1-9])/;
// Các kiểu gạch đổi thành "-", ký tự vô hình bỏ đi: liệt kê tường minh, không dùng \p{Pd}, \p{Cf} vì bảng Unicode của
// trình duyệt mới hơn của Java 17 ở máy chủ (ký tự mới thêm sẽ làm hai phía kết luận khác nhau)
const RE_GACH = new RegExp("[_\\u2010-\\u2015\\u2212\\uFE58\\uFE63\\uFF0D]", "g");
const RE_VO_HINH = new RegExp("[\\xAD\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF]", "g");
// Dài hơn thế này thì chắc chắn không phải biển số: trả lỗi ngay, không chuẩn hóa
const DO_DAI_TOI_DA = 64;
// Đang gõ dở: phần đầu của một biển đúng mẫu, số thứ tự chưa đủ 5 chữ số (4 số vẫn gõ thêm được); không mã tỉnh nào
// bắt đầu bằng 0 nên gõ "0" là báo ngay
const SO_DO = String.raw`(?:\d{0,4}|\d{3}[. ]\d?)`;
const RE_DANG_GO = [
    new RegExp(String.raw`^(?:[1-9]\d?)?$|^\d{2} ?(?:${CHU}|${SERI_O_TO_RIENG.join("|")})(?:[- ]?${SO_DO})?$`, "u"),
    new RegExp(
        String.raw`^\d{2}[- ]?(?:${CHU}(?:${CHU_2}|[1-9])?|MĐ[1-9]?)?$|^\d{2}[- ]?(?:${CHU}[1-9]|${CHU}${CHU_2}|MĐ[1-9]|MK[1-9])[- ]?${SO_DO}$`,
        "u",
    ),
    new RegExp(String.raw`^T ?(?:[1-9]\d?)?$|^T ?\d{2}[- ]?${SO_DO}$`, "u"),
];

/** Chữ mờ trong ô Biển số (cùng kiểu "Ví dụ: xe tải 1,5 tấn" của ô Phương tiện bên cạnh). */
export const VI_DU_BIEN_SO = "Ví dụ: 30A-123.45";
// Câu lỗi hiện dưới ô nửa hộp (~250px): giữ trong một dòng để hàng không giật khi lỗi hiện / mất
const LOI_MAU = "Chưa đúng mẫu, ví dụ 30A-123.45";

/**
 * Viết hoa; đổi các kiểu gạch thành "-", dấu phẩy thành dấu chấm; bỏ ký tự vô hình; mỗi cụm khoảng trắng thành một dấu
 * cách (giữ ranh giới giữa sê ri và số), bỏ khoảng trắng ở hai đầu và quanh "-", ".".
 */
function chuanHoaTho(chuoi) {
    return String(chuoi ?? "")
        .normalize("NFC")
        .toUpperCase()
        .replace(/\xD0/g, "Đ") // Ð (Eth) gõ nhầm thay Đ
        .replace(RE_GACH, "-")
        .replace(/[,\xB7]/g, ".")
        .replace(RE_VO_HINH, "")
        .replace(/[\s\p{Z}]+/gu, " ")
        .replace(/^ | $/g, "")
        .replace(/ ?([-.]) ?/g, "$1");
}

const loiMa = (ma) => ({ hopLe: false, loi: `2 số đầu "${ma}" không phải mã tỉnh` });

function loiMau(s) {
    if (/^[0-9OI]{2}/.test(s) && /[OI]/.test(s.slice(0, 2))) {
        return { hopLe: false, loi: "2 số đầu có chữ O/I, có thể là số 0/1" };
    }
    if (/[IJOQW]/.test(s)) return { hopLe: false, loi: "Không dùng chữ I, J, O, Q, W" };
    return { hopLe: false, loi: LOI_MAU };
}

function ketQua(loai, ma, giaTri, so) {
    if (!MA_DIA_PHUONG_BIEN_SO.has(ma)) return loiMa(ma);
    if (/^[0.]+$/.test(so)) return { hopLe: false, loi: "Số thứ tự không được toàn số 0" };
    return { hopLe: true, loai, giaTri };
}

/** Khớp chuỗi đã chuẩn hóa; khớp cả ô tô lẫn xe máy (29KT12345, 29B11234) thì là ô tô. */
function khop(s) {
    const tam = RE_TAM_THOI.exec(s);
    if (tam) return ketQua("TAM_THOI", tam[1], `T${tam[1]}-${tam[2]}.${tam[3]}`, tam[2] + tam[3]);
    const oTo = RE_O_TO.exec(s);
    const m = oTo ?? RE_XE_MAY.exec(s);
    if (!m) return loiMau(s);
    const [, ma, seri, ba, hai, bon] = m;
    const so = bon ?? `${ba}.${hai}`;
    return oTo ? ketQua("O_TO", ma, `${ma}${seri}-${so}`, so) : ketQua("XE_MAY", ma, `${ma}-${seri} ${so}`, so);
}

/**
 * `{ hopLe, giaTri, loai, loi }`: giaTri là cách viết lưu vào phiếu — ô tô "30A-123.45" (4 số cũ "29A-1234"), xe máy
 * "29-AB 123.45", biển tạm thời "T80-235.88"; loai "O_TO" | "XE_MAY" | "TAM_THOI". Xe máy viết có gạch sau 2 số đầu
 * ("29-KT 123.45"); không có gạch mà khớp cả hai loại thì hiểu là ô tô ("29KT12345" → "29KT-123.45").
 */
export function kiemTraBienSo(chuoi) {
    if (String(chuoi ?? "").length > DO_DAI_TOI_DA) return { hopLe: false, loi: LOI_MAU };
    const s = chuanHoaTho(chuoi);
    if (!s) return { hopLe: false, loi: "Nhập biển số xe" };
    const kq = khop(s);
    if (kq.hopLe) return kq;
    // Gõ "MD1" thay "MĐ1" (xe máy điện, biển cũ): "MD" cũng là sê ri xe máy 2 chữ nên chỉ thử khi chuỗi gõ vào không khớp
    const thayMd = s.replace(RE_MD, "$1MĐ");
    if (thayMd !== s) {
        const kqMd = khop(thayMd);
        if (kqMd.hopLe) return kqMd;
    }
    return kq;
}

/**
 * Câu lỗi để hiện ngay khi đang gõ (chỉ giao diện dùng): null khi chuỗi đã hợp lệ, còn trống hoặc vẫn gõ tiếp thành biển
 * đúng mẫu được ("30A-12", "29-M"); có câu lỗi khi chắc chắn sai dù gõ thêm gì ("827…", 2 số đầu "13", chữ O ở chỗ cần
 * số, quá 5 chữ số). Chuỗi dở dang chỉ bị báo khi rời ô hoặc bấm Xác nhận xuất (kiemTraBienSo).
 */
export function loiKhiDangGo(chuoi) {
    const kq = kiemTraBienSo(chuoi);
    if (kq.hopLe) return null;
    if (String(chuoi ?? "").length > DO_DAI_TOI_DA) return kq.loi;
    const s = chuanHoaTho(chuoi);
    if (!s) return null;
    const ma = /^T? ?(\d{2})/.exec(s)?.[1];
    if (ma && !MA_DIA_PHUONG_BIEN_SO.has(ma)) return loiMa(ma).loi;
    const thayMd = s.replace(RE_MD, "$1MĐ");
    return RE_DANG_GO.some((re) => re.test(s) || re.test(thayMd)) ? null : kq.loi;
}
