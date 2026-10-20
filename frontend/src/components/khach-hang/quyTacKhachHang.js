/**
 * Quy tắc của popup Thêm / Sửa khách hàng (chốt 19/10/2026) — trùng ràng buộc ở backend (KhachHangService)
 * để hai phía báo cùng một câu. Không có JSX để chạy kiểm thử bằng node --test, nên import bằng đường dẫn tương đối.
 */
import { nhanDiaChi } from "./chi-tiet/tinhKhachHang.js";

export { nhanDiaChi };

/** Độ dài tối đa = độ dài cột trong bảng khach_hang (địa chỉ: giới hạn của form). */
export const MAX_LENGTH = {
  maKhachHang: 50,
  tenKhachHang: 200,
  maSoThue: 14,
  nguoiLienHe: 100,
  soDienThoai: 11,
  email: 100,
  diaChi: 500,
};

/** Ba loại khách (cột loai_khach_hang); thêm mới chọn sẵn Khách lẻ như mặc định của cột. */
export const LOAI_KHACH_HANG = [
  { value: "le", label: "Khách lẻ", moTa: "Cá nhân mua để dùng" },
  { value: "si", label: "Khách sỉ", moTa: "Cửa hàng, đại lý mua để bán lại" },
  { value: "doanh_nghiep", label: "Doanh nghiệp", moTa: "Công ty mua theo báo giá" },
];
const LOAI_HOP_LE = LOAI_KHACH_HANG.map((loai) => loai.value);
export const LOAI_MAC_DINH_KHI_THEM = "le";

/** Thứ tự ô trên màn hình: bấm Lưu mà có lỗi thì con trỏ nhảy tới ô sai đầu tiên theo thứ tự này. */
export const THU_TU_O = ["loaiKhachHang", "tenKhachHang", "maKhachHang", "maSoThue", "nguoiLienHe", "soDienThoai", "email", "diaChi"];

/** Tên ô trong dòng "Đã sửa: …" ở chân popup. */
export const NHAN_O = {
  loaiKhachHang: "Loại khách",
  tenKhachHang: "Tên",
  maSoThue: "Mã số thuế",
  nguoiLienHe: "Người liên hệ",
  soDienThoai: "Số điện thoại",
  email: "Email",
  diaChi: "Địa chỉ",
};

const MA_REGEX = /^[A-Za-z0-9._-]+$/;
// Trùng EMAIL_PATTERN của backend.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Như nhà cung cấp: di động 10 số (03/05/07/08/09), máy bàn 11 số (02…), tổng đài 1800/1900.
const SO_DIEN_THOAI_REGEX = /^(0[35789][0-9]{8}|02[0-9]{9}|1[89]00[0-9]{4,6})$/;
// Trùng MA_SO_THUE_PATTERN của backend: doanh nghiệp 10 số, đơn vị phụ thuộc thêm "-3 số"; hộ/cá nhân kinh doanh 12 số.
const MA_SO_THUE_REGEX = /^(\d{10}(-\d{3})?|\d{12})$/;
export const MA_SO_THUE_MESSAGE = "Mã số thuế gồm 10 số (đơn vị phụ thuộc thêm -3 số) hoặc 12 số";

export const CAN_LIEN_HE = "Cần số điện thoại hoặc email để liên hệ khách hàng";
export const SO_DIEN_THOAI_MESSAGE =
  "Số điện thoại chưa đúng: di động 10 số, máy bàn 11 số (02…) hoặc tổng đài 1800/1900";

const gon = (value) => String(value ?? "").normalize("NFC").trim();

/** Gõ / dán số điện thoại: bỏ khoảng trắng, dấu chấm, gạch, ngoặc; "+84…" đổi về "0…"; chỉ giữ chữ số. */
export function chuanHoaSoDienThoaiKhiNhap(value) {
  const bo = String(value ?? "").replace(/[\s.()-]/g, "");
  const doi = bo.startsWith("+84") ? `0${bo.slice(3)}` : bo;
  return doi.replace(/\D/g, "").slice(0, MAX_LENGTH.soDienThoai);
}

/** Gõ / dán mã số thuế: chỉ giữ chữ số và dấu gạch (mã đơn vị phụ thuộc "0312345678-001"). */
export const chuanHoaMaSoThueKhiNhap = (value) =>
  String(value ?? "").replace(/[^\d-]/g, "").slice(0, MAX_LENGTH.maSoThue);

/** Mã nhập tay: viết hoa, không có khoảng trắng. */
export const chuanHoaMaKhiNhap = (value) =>
  String(value ?? "").toUpperCase().replace(/\s/g, "").slice(0, MAX_LENGTH.maKhachHang);

export const FORM_THEM = {
  loaiKhachHang: LOAI_MAC_DINH_KHI_THEM,
  tenKhachHang: "",
  maKhachHang: "",
  maSoThue: "",
  nguoiLienHe: "",
  soDienThoai: "",
  email: "",
  diaChi: "",
};

/**
 * Giá trị ban đầu của form. Sửa: giữ nguyên dữ liệu đang lưu (kể cả số điện thoại định dạng cũ) để mở form
 * không bị tính là đã sửa; khách chưa phân loại thì không chọn sẵn loại nào.
 */
export function formTuKhachHang(khachHang) {
  if (!khachHang) return { ...FORM_THEM };
  return {
    loaiKhachHang: LOAI_HOP_LE.includes(khachHang.loaiKhachHang) ? khachHang.loaiKhachHang : "",
    tenKhachHang: khachHang.tenKhachHang ?? "",
    maKhachHang: khachHang.maKhachHang ?? "",
    maSoThue: khachHang.maSoThue ?? "",
    nguoiLienHe: khachHang.nguoiLienHe ?? "",
    soDienThoai: khachHang.soDienThoai ?? "",
    email: khachHang.email ?? "",
    diaChi: khachHang.diaChi ?? "",
  };
}

/** Gợi ý ô tên theo loại khách. */
export function goiYTen(loai) {
  if (loai === "si") return "VD: Cửa hàng Thời trang An Phát";
  if (loai === "doanh_nghiep") return "VD: Công ty TNHH Thời trang Minh Khôi";
  return "VD: Nguyễn Văn An";
}

/** Người liên hệ: hiện với khách sỉ, doanh nghiệp, hoặc khi khách đã có dữ liệu (đổi sang Khách lẻ không làm mất). */
export function hienNguoiLienHe(form, banDau) {
  return (
    form.loaiKhachHang === "si" ||
    form.loaiKhachHang === "doanh_nghiep" ||
    Boolean(gon(form.nguoiLienHe)) ||
    Boolean(gon(banDau?.nguoiLienHe))
  );
}

/**
 * Mã số thuế (in ở khối Người mua của hóa đơn): như Người liên hệ — hiện với khách sỉ, doanh nghiệp,
 * hoặc khi khách đã có mã (đổi sang Khách lẻ không làm mất).
 */
export function hienMaSoThue(form, banDau) {
  return (
    form.loaiKhachHang === "si" ||
    form.loaiKhachHang === "doanh_nghiep" ||
    Boolean(gon(form.maSoThue)) ||
    Boolean(gon(banDau?.maSoThue))
  );
}

/** Các ô đã sửa so với lúc mở (bỏ khoảng trắng hai đầu); mã không sửa được nên không tính. */
export function cacOThayDoi(form, banDau) {
  return THU_TU_O.filter((name) => name !== "maKhachHang" && gon(form[name]) !== gon(banDau[name]));
}

/** Form thêm mới có gì khác trống không (để hỏi trước khi bỏ). */
export const formThemCoNhap = (form) => THU_TU_O.some((name) => gon(form[name]) !== gon(FORM_THEM[name]));

/**
 * Kiểm tra cả form; trả { tenO: câu báo lỗi }. Sửa: số điện thoại / email / địa chỉ không đổi thì không kiểm lại
 * (dữ liệu cũ không chặn việc sửa ô khác), giống backend.
 */
export function kiemTraForm(form, { laSua = false, banDau = FORM_THEM } = {}) {
  const loi = {};
  const giuNguyen = (name) => laSua && gon(form[name]) === gon(banDau[name]);

  const ten = gon(form.tenKhachHang);
  if (!ten) loi.tenKhachHang = "Nhập tên khách hàng";
  else if (ten.length > MAX_LENGTH.tenKhachHang) loi.tenKhachHang = "Tên khách hàng tối đa 200 ký tự";

  if (!laSua) {
    const ma = gon(form.maKhachHang);
    if (ma.length > MAX_LENGTH.maKhachHang) loi.maKhachHang = "Mã khách hàng tối đa 50 ký tự";
    else if (ma && !MA_REGEX.test(ma)) loi.maKhachHang = "Mã chỉ gồm chữ không dấu, số và . _ -";
  }

  const maSoThue = gon(form.maSoThue);
  if (maSoThue && !giuNguyen("maSoThue") && !MA_SO_THUE_REGEX.test(maSoThue)) loi.maSoThue = MA_SO_THUE_MESSAGE;

  if (gon(form.nguoiLienHe).length > MAX_LENGTH.nguoiLienHe) loi.nguoiLienHe = "Người liên hệ tối đa 100 ký tự";

  const sdt = gon(form.soDienThoai);
  const email = gon(form.email);
  if (sdt && !giuNguyen("soDienThoai") && !SO_DIEN_THOAI_REGEX.test(sdt)) loi.soDienThoai = SO_DIEN_THOAI_MESSAGE;
  if (email && !giuNguyen("email")) {
    if (email.length > MAX_LENGTH.email) loi.email = "Email tối đa 100 ký tự";
    else if (!EMAIL_REGEX.test(email)) loi.email = "Email chưa đúng, VD: ten@congty.vn";
  }
  // Khách cũ vốn không có cả hai thì vẫn sửa được ô khác; chỉ chặn khi người dùng xóa hết.
  const banDauCoLienHe = !laSua || Boolean(gon(banDau.soDienThoai) || gon(banDau.email));
  if (!sdt && !email && banDauCoLienHe) loi.soDienThoai = CAN_LIEN_HE;

  if (!giuNguyen("diaChi") && gon(form.diaChi).length > MAX_LENGTH.diaChi) loi.diaChi = "Địa chỉ tối đa 500 ký tự";
  return loi;
}

/** Nội dung gửi khi thêm: ô tùy chọn để trống gửi null; mã trống để máy chủ tự tạo. */
export function payloadThem(form) {
  const tuyChon = (value) => gon(value) || null;
  return {
    maKhachHang: tuyChon(form.maKhachHang),
    tenKhachHang: gon(form.tenKhachHang),
    loaiKhachHang: form.loaiKhachHang || LOAI_MAC_DINH_KHI_THEM,
    maSoThue: tuyChon(form.maSoThue),
    nguoiLienHe: tuyChon(form.nguoiLienHe),
    soDienThoai: tuyChon(form.soDienThoai),
    email: tuyChon(form.email),
    diaChi: tuyChon(form.diaChi),
  };
}

/**
 * Nội dung gửi khi sửa: chỉ các ô đã đổi (máy chủ hiểu null = giữ nguyên, "" = xóa ô).
 * Không bao giờ gửi trạng thái; khách chưa phân loại mà không chọn loại thì không gửi loại.
 */
export function payloadSua(form, banDau) {
  const payload = {};
  cacOThayDoi(form, banDau).forEach((name) => {
    if (name === "loaiKhachHang") {
      if (form.loaiKhachHang) payload.loaiKhachHang = form.loaiKhachHang;
      return;
    }
    payload[name] = gon(form[name]);
  });
  return payload;
}

/** Câu báo lỗi của máy chủ → ô tương ứng, để hiện ngay dưới ô đó; không nhận ra ô thì null. */
export function oCuaThongBaoMayChu(message) {
  const text = String(message ?? "").toLocaleLowerCase("vi-VN");
  if (text.includes("mã khách hàng")) return "maKhachHang";
  if (text.includes("tên khách hàng")) return "tenKhachHang";
  if (text.includes("mã số thuế")) return "maSoThue";
  if (text.includes("người liên hệ")) return "nguoiLienHe";
  // "Cần số điện thoại hoặc email…" cũng thuộc ô số điện thoại (ô đầu của nhóm liên hệ)
  if (text.includes("số điện thoại")) return "soDienThoai";
  if (text.includes("email")) return "email";
  if (text.includes("địa chỉ")) return "diaChi";
  if (text.includes("loại khách")) return "loaiKhachHang";
  return null;
}

/** Câu báo trùng khi kiểm tra trước lúc rời ô (cùng câu với máy chủ, thêm chữ "này" cho tự nhiên trong form). */
export function thongBaoTrung(name, khach) {
  const ai = `${khach.tenKhachHang}${khach.maKhachHang ? ` (${khach.maKhachHang})` : ""}`;
  return `${name === "email" ? "Email này" : "Số này"} đã thuộc khách hàng ${ai}`;
}

/** Có cần hỏi máy chủ xem số / email đã thuộc khách khác chưa: có giá trị, hợp lệ, và (khi sửa) đã đổi. */
export function canKiemTrung(name, form, { laSua = false, banDau = FORM_THEM } = {}) {
  const giaTri = gon(form[name]);
  if (!giaTri) return false;
  if (laSua && giaTri === gon(banDau[name])) return false;
  const loi = kiemTraForm(form, { laSua, banDau })[name];
  return !loi;
}
