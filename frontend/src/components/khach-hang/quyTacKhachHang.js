/**
 * Quy tắc của popup Thêm / Sửa khách hàng (chốt 19/10/2026) — trùng ràng buộc ở backend (KhachHangService)
 * để hai phía báo cùng một câu. Không có JSX để chạy kiểm thử bằng node --test, nên import bằng đường dẫn tương đối.
 */
import { t } from "../../i18n/t.js";
import { cauGocMayChu } from "../../i18n/cauGoc.js";
import { chuanHoaHoTen } from "../../validations/hoTen.js";

/**
 * Độ dài tối đa = độ dài cột trong bảng khach_hang (địa chỉ: giới hạn của form). Chỉ dùng để báo lỗi, không đặt
 * maxLength trên ô: trình duyệt cắt mất chữ khi dán (đếm UTF-16 trước NFC) mà không báo gì.
 */
export const MAX_LENGTH = {
  maKhachHang: 50,
  tenKhachHang: 200,
  soDienThoai: 11,
  email: 100,
  diaChi: 500,
};

/** Thứ tự ô trên màn hình: bấm Lưu mà có lỗi thì con trỏ nhảy tới ô sai đầu tiên theo thứ tự này. */
export const THU_TU_O = ["tenKhachHang", "maKhachHang", "soDienThoai", "email", "diaChi"];

/** Tên ô trong dòng "Đã sửa: …" ở chân popup. */
export const NHAN_O = {
  tenKhachHang: t("Tên"),
  soDienThoai: t("Số điện thoại"),
  email: "Email",
  diaChi: t("Địa chỉ"),
};

const TEN_TOI_THIEU = 2;
// Mã nhập tay: chữ không dấu, số và . _ -, mở đầu bằng chữ hoặc số (trùng MA_KHACH_HANG_PATTERN của backend).
const MA_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// Trùng EMAIL_PATTERN của backend: phần trước @ chỉ chữ không dấu, số và . _ % + - (không mở đầu / kết thúc bằng dấu
// chấm, không hai dấu chấm liền nhau); tên miền gồm nhãn chữ không dấu, số, gạch nối; đuôi ít nhất 2 chữ cái.
// Không dùng lookbehind: Safari / iOS dưới 16.4 báo lỗi cú pháp khi nạp module (màn POS cũng nạp tệp này).
const EMAIL_REGEX = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
// Khách hàng là một người: tên như luật họ tên — chữ cái, dấu cách, ' ’ . -; mở đầu bằng chữ cái.
const TEN_REGEX = /^\p{L}[\p{L}\p{M} '’.-]*$/u;
// Di động 10 số (03/05/07/08/09) hoặc máy bàn 11 số (02…). Không nhận tổng đài 1800/1900 (chỉ gọi vào, không nhắn tin,
// tra khách ở quầy theo số vô nghĩa).
const SO_DIEN_THOAI_REGEX = /^(0[35789][0-9]{8}|02[0-9]{9})$/;

export const CAN_LIEN_HE = t("Cần số điện thoại hoặc email để liên hệ khách hàng");
// Một dòng dưới ô nửa hộp; trùng banHang.soDienThoaiKhachHangSai của máy chủ.
export const SO_DIEN_THOAI_MESSAGE = t("Nhập di động 10 số hoặc máy bàn 11 số");

const gon = (value) => String(value ?? "").normalize("NFC").trim();
// Tên khách chuẩn hóa như họ tên (NFC, bỏ ký tự vô hình, gộp khoảng trắng), như máy chủ lưu.
const gonO = (name, value) => (name === "tenKhachHang" ? chuanHoaHoTen(value) : gon(value));
const soKyTu = (s) => [...s].length;

/** Câu lỗi của tên khách (chưa chuẩn hóa cũng được), "" khi hợp lệ. Dùng cả ở thêm nhanh khách tại quầy POS. */
export function loiTenKhachHang(value) {
  const ten = chuanHoaHoTen(value);
  if (!ten) return t("Nhập tên khách hàng");
  const doDai = soKyTu(ten);
  if (doDai > MAX_LENGTH.tenKhachHang) return t("Tên khách hàng tối đa 200 ký tự");
  if (doDai < TEN_TOI_THIEU) return t("Tên khách hàng cần ít nhất {{toiThieu}} ký tự", { toiThieu: TEN_TOI_THIEU });
  return TEN_REGEX.test(ten) ? "" : t("Tên khách hàng chỉ gồm chữ cái và dấu cách");
}

/** Câu lỗi của số điện thoại đã chuẩn hóa (không trống), "" khi hợp lệ. Dùng cả ở thêm nhanh khách tại quầy POS. */
export function loiSoDienThoai(sdt) {
  return SO_DIEN_THOAI_REGEX.test(gon(sdt)) ? "" : SO_DIEN_THOAI_MESSAGE;
}

/** Gõ / dán số điện thoại: bỏ khoảng trắng, dấu chấm, gạch, ngoặc; "+84…" đổi về "0…"; chỉ giữ chữ số. */
export function chuanHoaSoDienThoaiKhiNhap(value) {
  const bo = String(value ?? "").replace(/[\s.()-]/g, "");
  const doi = bo.startsWith("+84") ? `0${bo.slice(3)}` : bo;
  // Không cắt độ dài: dán thừa chữ số thì luật kiểm báo sai, không lặng lẽ thành một số khác.
  return doi.replace(/\D/g, "");
}

/** Mã nhập tay: viết hoa, không có khoảng trắng (không cắt độ dài: quá dài thì báo lỗi). */
export const chuanHoaMaKhiNhap = (value) => String(value ?? "").toUpperCase().replace(/\s/g, "");

export const FORM_THEM = {
  tenKhachHang: "",
  maKhachHang: "",
  soDienThoai: "",
  email: "",
  diaChi: "",
};

/**
 * Giá trị ban đầu của form. Sửa: giữ nguyên dữ liệu đang lưu (kể cả số điện thoại định dạng cũ) để mở form
 * không bị tính là đã sửa.
 */
export function formTuKhachHang(khachHang) {
  if (!khachHang) return { ...FORM_THEM };
  return {
    tenKhachHang: khachHang.tenKhachHang ?? "",
    maKhachHang: khachHang.maKhachHang ?? "",
    soDienThoai: khachHang.soDienThoai ?? "",
    email: khachHang.email ?? "",
    diaChi: khachHang.diaChi ?? "",
  };
}

/** Các ô đã sửa so với lúc mở (so sau khi chuẩn hóa); mã không sửa được nên không tính. */
export function cacOThayDoi(form, banDau) {
  return THU_TU_O.filter((name) => name !== "maKhachHang" && gonO(name, form[name]) !== gonO(name, banDau[name]));
}

/** Form thêm mới có gì khác trống không (để hỏi trước khi bỏ). */
export const formThemCoNhap = (form) => THU_TU_O.some((name) => gon(form[name]) !== gon(FORM_THEM[name]));

/**
 * Kiểm tra cả form; trả { tenO: câu báo lỗi }. Sửa: ô không đổi thì không kiểm lại (dữ liệu cũ không chặn việc sửa
 * ô khác), giống backend; xóa trắng tên thì luôn báo.
 */
export function kiemTraForm(form, { laSua = false, banDau = FORM_THEM } = {}) {
  const loi = {};
  const giuNguyen = (name) => laSua && gonO(name, form[name]) === gonO(name, banDau[name]);

  const ten = chuanHoaHoTen(form.tenKhachHang);
  if (!ten) loi.tenKhachHang = t("Nhập tên khách hàng");
  else if (!giuNguyen("tenKhachHang")) {
    const loiTen = loiTenKhachHang(ten);
    if (loiTen) loi.tenKhachHang = loiTen;
  }

  if (!laSua) {
    const ma = gon(form.maKhachHang);
    if (ma.length > MAX_LENGTH.maKhachHang) loi.maKhachHang = t("Mã khách hàng tối đa 50 ký tự");
    else if (ma && !MA_REGEX.test(ma)) loi.maKhachHang = t("Mã gồm chữ không dấu, số và . _ -, mở đầu bằng chữ hoặc số");
  }

  const sdt = gon(form.soDienThoai);
  const email = gon(form.email);
  if (sdt && !giuNguyen("soDienThoai")) {
    const loiSdt = loiSoDienThoai(sdt);
    if (loiSdt) loi.soDienThoai = loiSdt;
  }
  if (email && !giuNguyen("email")) {
    if (email.length > MAX_LENGTH.email) loi.email = t("Email tối đa 100 ký tự");
    else if (!EMAIL_REGEX.test(email)) loi.email = t("Email chưa đúng, VD: ten@congty.vn");
  }
  // Khách cũ vốn không có cả hai thì vẫn sửa được ô khác; chỉ chặn khi người dùng xóa hết.
  const banDauCoLienHe = !laSua || Boolean(gon(banDau.soDienThoai) || gon(banDau.email));
  if (!sdt && !email && banDauCoLienHe) loi.soDienThoai = CAN_LIEN_HE;

  if (!giuNguyen("diaChi") && soKyTu(gon(form.diaChi)) > MAX_LENGTH.diaChi) loi.diaChi = t("Địa chỉ tối đa 500 ký tự");
  return loi;
}

/** Nội dung gửi khi thêm: ô tùy chọn để trống gửi null; mã trống để máy chủ tự tạo. */
export function payloadThem(form) {
  const tuyChon = (value) => gon(value) || null;
  return {
    maKhachHang: tuyChon(form.maKhachHang),
    tenKhachHang: chuanHoaHoTen(form.tenKhachHang),
    soDienThoai: tuyChon(form.soDienThoai),
    email: tuyChon(form.email),
    diaChi: tuyChon(form.diaChi),
  };
}

/** Nội dung gửi khi sửa: chỉ các ô đã đổi (máy chủ hiểu null = giữ nguyên, "" = xóa ô). Không bao giờ gửi trạng thái. */
export function payloadSua(form, banDau) {
  const payload = {};
  cacOThayDoi(form, banDau).forEach((name) => {
    payload[name] = gonO(name, form[name]);
  });
  return payload;
}

// Đầu câu báo lỗi của máy chủ (câu gốc tiếng Việt, viết thường) → ô. Chỉ để tra cứu, không hiện ra giao diện.
const DAU_CAU_MAY_CHU = [
  ["mã khách hàng", "maKhachHang"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["tên ", "tenKhachHang"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["cần số điện thoại hoặc email", "soDienThoai"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["nhập di động", "soDienThoai"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["số điện thoại", "soDienThoai"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["email", "email"],
  ["địa chỉ", "diaChi"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
];

/** Câu báo lỗi của máy chủ → ô tương ứng, để hiện ngay dưới ô đó; không nhận ra ô thì null. */
export function oCuaThongBaoMayChu(message) {
  // Dò trên câu gốc tiếng Việt (giao diện tiếng Anh nhận câu đã dịch)
  const text = String(cauGocMayChu(message) ?? "").toLocaleLowerCase("vi-VN");
  // Xét đầu câu trước: câu trùng có chèn tên khách ("Email đã thuộc khách hàng Nguyễn Số…"), dò "chứa" có thể nhầm ô.
  const theoDauCau = DAU_CAU_MAY_CHU.find(([dau]) => text.startsWith(dau));
  if (theoDauCau) return theoDauCau[1];
  if (text.includes("mã khách hàng")) return "maKhachHang";
  if (text.includes("tên khách hàng")) return "tenKhachHang";
  // "Cần số điện thoại hoặc email…" cũng thuộc ô số điện thoại (ô đầu của nhóm liên hệ)
  if (text.includes("số điện thoại")) return "soDienThoai";
  if (text.includes("email")) return "email";
  if (text.includes("địa chỉ")) return "diaChi";
  return null;
}

/** Câu báo trùng khi kiểm tra trước lúc rời ô (cùng câu với máy chủ, thêm chữ "này" cho tự nhiên trong form). */
export function thongBaoTrung(name, khach) {
  const ai = `${khach.tenKhachHang}${khach.maKhachHang ? ` (${khach.maKhachHang})` : ""}`;
  if (name === "email") return t("Email này đã thuộc khách hàng {{ai}}", { ai });
  return t("Số này đã thuộc khách hàng {{ai}}", { ai });
}

/** Có cần hỏi máy chủ xem số / email đã thuộc khách khác chưa: có giá trị, hợp lệ, và (khi sửa) đã đổi. */
export function canKiemTrung(name, form, { laSua = false, banDau = FORM_THEM } = {}) {
  const giaTri = gon(form[name]);
  if (!giaTri) return false;
  if (laSua && giaTri === gon(banDau[name])) return false;
  const loi = kiemTraForm(form, { laSua, banDau })[name];
  return !loi;
}
