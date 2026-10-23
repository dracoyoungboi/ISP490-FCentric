/**
 * Quy tắc nhập liệu nhà cung cấp — trùng với ràng buộc ở backend (NhaCungCapCreating/Updating)
 * để hai phía báo cùng một câu.
 */

export const TRANG_THAI_NCC = { NGUNG_HOAT_DONG: 0, HOAT_DONG: 1 };

export const laHoatDong = (supplier) => supplier?.trangThai === TRANG_THAI_NCC.HOAT_DONG;

/** Có thể gửi yêu cầu báo giá: đang hoạt động và có email (yêu cầu gửi qua email). */
export const coTheGuiYeuCauBaoGia = (supplier) =>
    laHoatDong(supplier) && Boolean(supplier?.email?.trim());

/** Độ dài tối đa = độ dài cột trong bảng nha_cung_cap. */
export const MAX_LENGTH = {
    maNhaCungCap: 50,
    tenNhaCungCap: 200,
    nguoiLienHe: 100,
    soDienThoai: 11,
    email: 100,
    diaChi: 500,
};

const MA_REGEX = /^[A-Za-z0-9._-]+$/;
// Trùng regex email của form người dùng / backend.
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Doanh nghiệp hay dùng số bàn hoặc tổng đài, không chỉ di động:
// di động 10 số (03/05/07/08/09), cố định 11 số (02…), tổng đài 1800/1900 (8–10 số).
const SO_DIEN_THOAI_REGEX = /^(0[35789][0-9]{8}|02[0-9]{9}|1[89]00[0-9]{4,6})$/;

export const SO_DIEN_THOAI_MESSAGE =
    "Số điện thoại không hợp lệ (di động 10 số, số bàn 11 số bắt đầu bằng 02, hoặc tổng đài 1800/1900)";

/** Chỉ giữ chữ số khi gõ / dán số điện thoại. */
export const chiGiuChuSo = (value, max) => (value ?? "").replace(/\D/g, "").slice(0, max);

export const FORM_TRONG = {
    maNhaCungCap: "",
    tenNhaCungCap: "",
    nguoiLienHe: "",
    soDienThoai: "",
    email: "",
    diaChi: "",
    nganHang: "",
    soNganHang: "",
};

/** Dữ liệu cũ có thể lưu "+84 987 654 321" (form cũ cho phép +84): đổi về dạng 0987654321 khi mở form sửa. */
export function chuanHoaSoDienThoai(value) {
    const raw = String(value ?? "").trim();
    const digits = raw.replace(/\D/g, "");
    if (raw.startsWith("+84") || (digits.startsWith("84") && digits.length === 11)) {
        return `0${digits.slice(2)}`;
    }
    return digits;
}

export const formTuNhaCungCap = (supplier) =>
    supplier
        ? {
              maNhaCungCap: supplier.maNhaCungCap ?? "",
              tenNhaCungCap: supplier.tenNhaCungCap ?? "",
              nguoiLienHe: supplier.nguoiLienHe ?? "",
              soDienThoai: chuanHoaSoDienThoai(supplier.soDienThoai),
              email: supplier.email ?? "",
              diaChi: supplier.diaChi ?? "",
              nganHang: supplier.nganHang ?? "",
              soNganHang: supplier.soNganHang ?? "",
          }
        : FORM_TRONG;

/** Kiểm tra từng ô; trả "" khi hợp lệ. */
export const VALIDATORS = {
    maNhaCungCap: (value) => {
        const ma = value.trim();
        if (!ma) return "Vui lòng nhập mã nhà cung cấp";
        if (!MA_REGEX.test(ma)) return "Chỉ dùng chữ không dấu, số và các ký tự . _ -";
        return "";
    },
    tenNhaCungCap: (value) => (value.trim() ? "" : "Vui lòng nhập tên nhà cung cấp"),
    nguoiLienHe: () => "",
    soDienThoai: (value) => {
        if (!value) return "Vui lòng nhập số điện thoại";
        return SO_DIEN_THOAI_REGEX.test(value) ? "" : SO_DIEN_THOAI_MESSAGE;
    },
    email: (value) => {
        const email = value.trim();
        if (!email) return "Vui lòng nhập email";
        return EMAIL_REGEX.test(email) ? "" : "Vui lòng nhập đúng định dạng email";
    },
    diaChi: () => "",
};

/**
 * Nội dung gửi lên API: bỏ khoảng trắng hai đầu, ô tùy chọn để trống gửi null. Ngân hàng / số tài khoản không còn ô nhập
 * (không quản lý thanh toán nhà cung cấp): thêm mới gửi null; sửa thì gửi lại nguyên giá trị đang có của nhà cung cấp
 * (formTuNhaCungCap) vì PUT ghi đè mọi trường.
 */
export function payloadTuForm(form, { laSua }) {
    const tuyChon = (value) => value.trim() || null;
    const payload = {
        tenNhaCungCap: form.tenNhaCungCap.trim(),
        nguoiLienHe: tuyChon(form.nguoiLienHe),
        soDienThoai: form.soDienThoai.trim(),
        email: form.email.trim(),
        diaChi: tuyChon(form.diaChi),
        nganHang: tuyChon(form.nganHang),
        soNganHang: tuyChon(form.soNganHang),
    };
    return laSua ? payload : { maNhaCungCap: form.maNhaCungCap.trim(), ...payload };
}

/** Câu báo lỗi của máy chủ (không phải lỗi theo từng ô) → ô tương ứng, để hiện ngay dưới ô đó. */
export function oCuaThongBaoMayChu(message) {
    const text = (message ?? "").toLowerCase();
    if (text.includes("mã nhà cung cấp")) return "maNhaCungCap";
    if (text.includes("tên nhà cung cấp")) return "tenNhaCungCap";
    if (text.includes("số tài khoản")) return "soNganHang";
    if (text.includes("ngân hàng")) return "nganHang";
    if (text.includes("email")) return "email";
    if (text.includes("số điện thoại")) return "soDienThoai";
    return null;
}
