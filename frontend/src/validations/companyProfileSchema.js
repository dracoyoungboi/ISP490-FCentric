// Thông tin cửa hàng (bảng thong_tin_cong_ty) — dùng chung cho trang Cấu hình › Thông tin cửa hàng,
// hộp thoại sửa nhanh trong trình sửa mẫu in và khung chặn gửi yêu cầu báo giá. Hàm thuần, chạy được với node --test.
// Quy tắc khớp ThongTinCongTyService ở máy chủ (chuẩn hóa mã số thuế, độ dài, logo PNG/JPEG ≤ 2 MB).

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;
// Mã số thuế: doanh nghiệp 10 số, đơn vị phụ thuộc thêm "-3 số"; hộ/cá nhân kinh doanh dùng số định danh 12 số
export const TAX_CODE_RE = /^(\d{10}(-\d{3})?|\d{12})$/;

/** Độ dài tối đa tên cửa hàng, tên đăng ký kinh doanh — khớp ThongTinCongTyService.TEN_TOI_DA (cột varchar(255)). */
export const TEN_TOI_DA = 255;
/** Độ dài tối đa email cửa hàng — khớp ThongTinCongTyService.EMAIL_TOI_DA (cột email varchar(100)). */
export const EMAIL_TOI_DA = 100;
/** Logo tối đa 2 MB — khớp ThongTinCongTyService.LOGO_TOI_DA_BYTE. */
export const LOGO_TOI_DA_BYTE = 2 * 1024 * 1024;
/** Giới hạn logo viết bằng chữ ("2 MB"), dựng từ LOGO_TOI_DA_BYTE cho mọi câu nhắc tới giới hạn này. */
export const LOGO_TOI_DA_CHU = `${(LOGO_TOI_DA_BYTE / (1024 * 1024)).toLocaleString("vi-VN")} MB`;
/** Chỉ PNG, JPEG: email (Gmail, Outlook) không hiện ảnh SVG. Máy chủ kiểm thêm byte đầu tệp. */
export const LOAI_LOGO_NHAN = ["image/png", "image/jpeg"];
/** Giá trị `accept` của ô chọn tệp logo. */
export const LOGO_ACCEPT = LOAI_LOGO_NHAN.join(",");

export const LOI_LOGO_SAI_LOAI = "Chỉ nhận ảnh PNG hoặc JPG.";
export const LOI_LOGO_QUA_LON = `Ảnh lớn hơn ${LOGO_TOI_DA_CHU}.`;

/** Thứ tự ô của cả hồ sơ (hộp sửa nhanh lưu đủ 6 ô). */
export const COMPANY_PROFILE_FIELDS = ["name", "legalName", "taxCode", "address", "phone", "email"];
/** Ô của thẻ "Tên và logo" (logo tải riêng). */
export const KHOA_TEN_VA_LOGO = ["name"];
/** Ô của thẻ "Pháp lý và liên hệ". */
export const KHOA_PHAP_LY_LIEN_HE = ["legalName", "taxCode", "address", "phone", "email"];

/** Nhãn từng ô — một nguồn cho trang, hộp sửa nhanh và khung chặn gửi yêu cầu báo giá. */
export const NHAN_THONG_TIN_CUA_HANG = {
  name: "Tên cửa hàng",
  legalName: "Tên đăng ký kinh doanh",
  taxCode: "Mã số thuế",
  address: "Địa chỉ đăng ký",
  phone: "Điện thoại",
  email: "Email",
};

/** Ô bắt buộc để gửi email cho nhà cung cấp (máy chủ chặn gửi yêu cầu báo giá khi thiếu, mã THIEU_THONG_TIN_CUA_HANG). */
export const KHOA_BAT_BUOC_GUI_NHA_CUNG_CAP = ["legalName", "address"];

export const LOAI_MA_SO_THUE = {
  DOANH_NGHIEP: "Doanh nghiệp",
  CHI_NHANH: "Chi nhánh, đơn vị phụ thuộc",
  HO_KINH_DOANH: "Hộ, cá nhân kinh doanh",
};

const catKhoangTrang = (value) => (value ?? "").trim();

/** Bỏ khoảng trắng và dấu chấm: "0109.123.456" -> "0109123456" (như máy chủ). */
export function chuanHoaMaSoThue(value) {
  return (value ?? "").replace(/[\s.]/g, "");
}

/** Giá trị sẽ lưu của một ô: mã số thuế chuẩn hóa, các ô khác bỏ khoảng trắng đầu/cuối. */
export function chuanHoaO(key, value) {
  return key === "taxCode" ? chuanHoaMaSoThue(value) : catKhoangTrang(value);
}

/** Loại mã số thuế theo dạng mã (đã hoặc chưa chuẩn hóa); không nhận dạng được thì "". */
export function loaiMaSoThue(maSoThue) {
  const ma = chuanHoaMaSoThue(maSoThue);
  if (/^\d{10}$/.test(ma)) return LOAI_MA_SO_THUE.DOANH_NGHIEP;
  if (/^\d{10}-\d{3}$/.test(ma)) return LOAI_MA_SO_THUE.CHI_NHANH;
  if (/^\d{12}$/.test(ma)) return LOAI_MA_SO_THUE.HO_KINH_DOANH;
  return "";
}

/**
 * Cảnh báo (không chặn lưu) khi loại mã số thuế không khớp loại chủ thể trong tên đăng ký kinh doanh.
 * Cá nhân kinh doanh (mã 12 số) có thể ghi họ tên nên không cảnh báo. Trả "" khi không lệch.
 */
export function lechLoaiMaSoThue(tenDangKy, maSoThue) {
  const ten = catKhoangTrang(tenDangKy).toLowerCase();
  const loai = loaiMaSoThue(maSoThue);
  if (!ten || !loai) return "";
  const laCongTy = /^(công ty|cty|doanh nghiệp tư nhân|dntn)/.test(ten);
  if (loai === LOAI_MA_SO_THUE.HO_KINH_DOANH && laCongTy) {
    return "Mã 12 số là của hộ, cá nhân kinh doanh; công ty, doanh nghiệp tư nhân dùng mã 10 số.";
  }
  if (loai === LOAI_MA_SO_THUE.DOANH_NGHIEP && ten.startsWith("hộ kinh doanh")) {
    return "Mã 10 số là của doanh nghiệp; hộ kinh doanh dùng mã 12 số.";
  }
  if (loai === LOAI_MA_SO_THUE.CHI_NHANH && !/chi nhánh|địa điểm kinh doanh|văn phòng đại diện/.test(ten)) {
    return 'Mã có -3 số là của đơn vị phụ thuộc: tên phải gồm tên công ty và cụm từ "Chi nhánh" hoặc "Địa điểm kinh doanh".';
  }
  return "";
}

/**
 * Câu nhận dạng dưới ô Mã số thuế khi đang sửa: "Nhận dạng: {loại}." — trang thêm "Sẽ lưu thành {mã}." khi mã
 * gõ có khoảng trắng/dấu chấm (`kemMaSeLuu`). Không nhận dạng được thì "" (hiện gợi ý thường).
 */
export function cauNhanDangMaSoThue(giaTriGo, { kemMaSeLuu = false } = {}) {
  const ma = chuanHoaMaSoThue(giaTriGo);
  const loai = loaiMaSoThue(ma);
  if (!loai) return "";
  if (kemMaSeLuu && ma !== catKhoangTrang(giaTriGo)) return `Nhận dạng: ${loai}. Sẽ lưu thành ${ma}.`;
  return `Nhận dạng: ${loai}.`;
}

/**
 * Số điện thoại khi hiện (lưu như đã nhập): máy bàn 02 + 9 số -> 3-4-4; di động 0 + 9 số -> 4-3-3;
 * 1800/1900 + 4 hoặc 6 số. Có ký tự lạ (+84, chữ…) hoặc dạng khác thì giữ nguyên.
 */
export function dinhDangDienThoai(value) {
  const s = catKhoangTrang(value);
  const d = s.replace(/\D/g, "");
  if (/[^0-9\s.\-()]/.test(s)) return s;
  if (/^02\d{9}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (/^1[89]00\d{4}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (/^1[89]00\d{6}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return s;
}

/** Form sửa lấy từ hồ sơ đã lưu (giá trị null thành chuỗi rỗng). */
export function companyProfileForm(profile) {
  return Object.fromEntries(COMPANY_PROFILE_FIELDS.map((key) => [key, profile?.[key] ?? ""]));
}

/** Lỗi thẻ "Tên và logo": { name? }. */
export function validateTenVaLogo(form) {
  const errors = {};
  const ten = catKhoangTrang(form?.name);
  if (!ten) errors.name = "Nhập tên cửa hàng.";
  else if (ten.length > TEN_TOI_DA) errors.name = `Tên cửa hàng tối đa ${TEN_TOI_DA} ký tự.`;
  return errors;
}

/** Lỗi thẻ "Pháp lý và liên hệ": tên đăng ký và địa chỉ đăng ký bắt buộc; mã số thuế, email, điện thoại đúng dạng. */
export function validatePhapLyLienHe(form) {
  const errors = {};
  const tenDangKy = catKhoangTrang(form?.legalName);
  if (!tenDangKy) errors.legalName = "Nhập tên đăng ký kinh doanh.";
  else if (tenDangKy.length > TEN_TOI_DA) errors.legalName = `Tên đăng ký kinh doanh tối đa ${TEN_TOI_DA} ký tự.`;

  const maSoThue = chuanHoaMaSoThue(form?.taxCode);
  if (maSoThue && !TAX_CODE_RE.test(maSoThue)) {
    errors.taxCode = "Mã số thuế gồm 10 số (đơn vị phụ thuộc thêm -3 số) hoặc 12 số.";
  }

  if (!catKhoangTrang(form?.address)) errors.address = "Nhập địa chỉ đăng ký.";

  const dienThoai = catKhoangTrang(form?.phone);
  if (dienThoai && !PHONE_RE.test(dienThoai)) errors.phone = "Số điện thoại không hợp lệ.";

  const email = catKhoangTrang(form?.email);
  if (email && !EMAIL_RE.test(email)) errors.email = "Email không hợp lệ.";
  else if (email.length > EMAIL_TOI_DA) errors.email = `Email tối đa ${EMAIL_TOI_DA} ký tự.`;
  return errors;
}

/** Lỗi cả hồ sơ (hộp sửa nhanh lưu đủ hai phần). Rỗng nghĩa là hợp lệ. */
export function validateCompanyProfile(form) {
  return { ...validateTenVaLogo(form), ...validatePhapLyLienHe(form) };
}

/** Form có khác hồ sơ đã lưu không, so sau chuẩn hóa ("0109.123.456" bằng "0109123456"). */
export function isCompanyProfileChanged(saved, form, keys = COMPANY_PROFILE_FIELDS) {
  return keys.some((key) => chuanHoaO(key, saved?.[key]) !== chuanHoaO(key, form?.[key]));
}

const payloadTheo = (keys) => (form) => Object.fromEntries(keys.map((key) => [key, chuanHoaO(key, form?.[key])]));

/**
 * Dữ liệu gửi máy chủ, đã chuẩn hóa. Máy chủ coi trường không gửi là giữ nguyên, chuỗi rỗng là xóa,
 * nên mỗi thẻ chỉ gửi ô của mình (lưu thẻ này không ghi đè thay đổi của người khác ở thẻ kia).
 */
export const payloadTenVaLogo = payloadTheo(KHOA_TEN_VA_LOGO);
export const payloadPhapLyLienHe = payloadTheo(KHOA_PHAP_LY_LIEN_HE);
export const companyProfilePayload = payloadTheo(COMPANY_PROFILE_FIELDS);

/**
 * Nhãn các ô còn thiếu để gửi email cho nhà cung cấp, theo thứ tự [Tên đăng ký kinh doanh, Địa chỉ đăng ký].
 * Chưa đọc được hồ sơ (null) thì trả [] — giao diện không chặn, máy chủ vẫn chặn.
 */
export function oThieuDeGuiNhaCungCap(profile) {
  if (!profile) return [];
  return KHOA_BAT_BUOC_GUI_NHA_CUNG_CAP.filter((key) => !catKhoangTrang(profile[key])).map(
    (key) => NHAN_THONG_TIN_CUA_HANG[key],
  );
}

/** Kiểm tệp logo lúc chọn: "" nếu nhận, ngược lại câu báo dưới nút Chọn ảnh logo. */
export function kiemTepLogo(file) {
  if (!file) return "";
  if (!LOAI_LOGO_NHAN.includes((file.type ?? "").toLowerCase())) return LOI_LOGO_SAI_LOAI;
  if (file.size > LOGO_TOI_DA_BYTE) return LOI_LOGO_QUA_LON;
  return "";
}
