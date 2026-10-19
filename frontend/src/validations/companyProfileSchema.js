// Thông tin cửa hàng (bảng thong_tin_cong_ty) — dùng chung cho trang Cấu hình › Thông tin cửa hàng
// và hộp thoại sửa nhanh trong trình chỉnh sửa mẫu in. Hàm thuần, chạy được với node --test.

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;

export const COMPANY_PROFILE_FIELDS = ["name", "phone", "email", "address"];

const chuan = (value) => (value ?? "").trim();

/** Form sửa lấy từ hồ sơ đã lưu (giá trị null thành chuỗi rỗng). */
export function companyProfileForm(profile) {
  return Object.fromEntries(COMPANY_PROFILE_FIELDS.map((key) => [key, profile?.[key] ?? ""]));
}

/** Lỗi theo từng ô: { name?, email?, phone? }. Rỗng nghĩa là hợp lệ. */
export function validateCompanyProfile(form) {
  const errors = {};
  if (!chuan(form?.name)) errors.name = "Nhập tên cửa hàng.";
  if (chuan(form?.email) && !EMAIL_RE.test(chuan(form.email))) errors.email = "Email không hợp lệ.";
  if (chuan(form?.phone) && !PHONE_RE.test(chuan(form.phone))) errors.phone = "Số điện thoại không hợp lệ.";
  return errors;
}

/** Form có khác hồ sơ đã lưu không (bỏ khoảng trắng đầu/cuối khi so). */
export function isCompanyProfileChanged(saved, form) {
  return COMPANY_PROFILE_FIELDS.some((key) => chuan(saved?.[key]) !== chuan(form?.[key]));
}

/** Dữ liệu gửi máy chủ: đã bỏ khoảng trắng đầu/cuối. */
export function companyProfilePayload(form) {
  return Object.fromEntries(COMPANY_PROFILE_FIELDS.map((key) => [key, chuan(form?.[key])]));
}
