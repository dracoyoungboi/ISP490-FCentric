// Quy tắc SĐT di động Việt Nam (định dạng trong nước):
// đúng 10 chữ số, bắt đầu bằng 03/05/07/08/09. Lưu dạng chuỗi để giữ số 0 đầu.
export const PHONE_REGEX = /^0[35789][0-9]{8}$/;

export const PHONE_ERROR_MESSAGE =
    "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03/05/07/08/09)";

// Giữ lại chữ số, tối đa 10 ký tự — gọi trong onChange để chặn chữ cái và ký tự khác khi gõ/paste
export const sanitizePhoneInput = (value) =>
    (value ?? "").replace(/\D/g, "").slice(0, 10);

// SĐT là tùy chọn: null/undefined/""/khoảng trắng đều hợp lệ; chỉ kiểm tra khi thực sự có giá trị
export const isPhoneValid = (value) => {
    const phone = (value ?? "").trim();
    if (!phone) return true;
    return PHONE_REGEX.test(phone);
};

// Lỗi validate real-time: không báo lỗi khi đang gõ dang dở (dưới 10 số vẫn có thể hợp lệ),
// đủ 10 số mà sai định dạng thì báo ngay; hợp lệ thì trả về "" (xóa lỗi).
export const getPhoneError = (value) => {
    const phone = (value ?? "").trim();
    if (!phone || phone.length < 10) return "";
    if (!PHONE_REGEX.test(phone)) return PHONE_ERROR_MESSAGE;
    return "";
};
