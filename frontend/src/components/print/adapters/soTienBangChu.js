/**
 * Đọc số tiền thành chữ tiếng Việt cho dòng "Bằng chữ" trên chứng từ:
 * 4300000 -> "Bốn triệu ba trăm nghìn đồng".
 *
 * Quy tắc đọc theo cách ghi phổ biến trên chứng từ kế toán:
 * - "linh" cho hàng chục bằng 0 (105 -> một trăm linh năm);
 * - "mốt" khi hàng đơn vị là 1 sau hàng chục từ 2 trở lên (21 -> hai mươi mốt);
 * - "lăm" khi hàng đơn vị là 5 sau hàng chục từ 1 trở lên (15, 25 -> mười lăm, hai mươi lăm);
 * - nhóm giữa số có hàng trăm bằng 0 đọc đủ "không trăm" (1.005.000 -> một triệu không trăm linh năm nghìn);
 * - đơn vị nhóm: nghìn, triệu, tỷ; trên tỷ ghép tiếp (nghìn tỷ, triệu tỷ).
 * Số lẻ dưới 1 đồng được làm tròn. Không hợp lệ -> null (ẩn dòng "Bằng chữ").
 *
 * Không import "@/…" để chạy được bằng `node --test`.
 */
const CHU_SO = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const DON_VI_NHOM = ["", "nghìn", "triệu"];

function docBaChuSo(so, docDu) {
    const tram = Math.floor(so / 100);
    const chuc = Math.floor((so % 100) / 10);
    const donVi = so % 10;
    const chu = [];
    if (tram > 0 || docDu) chu.push(CHU_SO[tram], "trăm");
    if (chuc === 0) {
        if (donVi > 0 && (tram > 0 || docDu)) chu.push("linh");
    } else if (chuc === 1) {
        chu.push("mười");
    } else {
        chu.push(CHU_SO[chuc], "mươi");
    }
    if (donVi > 0) {
        if (donVi === 1 && chuc > 1) chu.push("mốt");
        else if (donVi === 5 && chuc > 0) chu.push("lăm");
        else chu.push(CHU_SO[donVi]);
    }
    return chu.join(" ");
}

/** Đọc số nguyên không âm (tối đa Number.MAX_SAFE_INTEGER) thành chữ thường. */
export function docSoNguyen(so) {
    if (!Number.isSafeInteger(so) || so < 0) return null;
    if (so === 0) return "không";
    const nhom = [];
    for (let con = so; con > 0; con = Math.floor(con / 1000)) nhom.push(con % 1000);
    const chu = [];
    for (let i = nhom.length - 1; i >= 0; i -= 1) {
        if (nhom[i] === 0) continue;
        const laNhomDau = chu.length === 0;
        const donVi = [DON_VI_NHOM[i % 3], ...Array(Math.floor(i / 3)).fill("tỷ")]
            .filter(Boolean)
            .join(" ");
        chu.push(docBaChuSo(nhom[i], !laNhomDau) + (donVi ? ` ${donVi}` : ""));
    }
    return chu.join(" ");
}

/** "Bốn triệu ba trăm nghìn đồng" — số âm thêm "Âm"; không hợp lệ -> null. */
export function docSoTienBangChu(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const rounded = Math.round(Math.abs(number));
    const words = docSoNguyen(rounded);
    if (!words) return null;
    const text = `${number < 0 && rounded > 0 ? "âm " : ""}${words} đồng`;
    return text.charAt(0).toUpperCase() + text.slice(1);
}
