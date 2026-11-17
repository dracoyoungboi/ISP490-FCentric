/**
 * Quy tắc của popup Thêm / Sửa khách hàng (chốt 19/10/2026) — trùng ràng buộc ở backend (KhachHangService)
 * để hai phía báo cùng một câu. Không có JSX để chạy kiểm thử bằng node --test, nên import bằng đường dẫn tương đối.
 */
import { nhanDiaChi } from "./chi-tiet/tinhKhachHang.js";
import { t } from "../../i18n/t.js";
import { cauGocMayChu } from "../../i18n/cauGoc.js";
import { chuanHoaHoTen } from "../../validations/hoTen.js";
import { maSoThueDungDang, maSoThueHopLe } from "../../validations/maSoThue.js";

export { nhanDiaChi };

/**
 * Độ dài tối đa = độ dài cột trong bảng khach_hang (địa chỉ: giới hạn của form). Chỉ dùng để báo lỗi, không đặt
 * maxLength trên ô: trình duyệt cắt mất chữ khi dán (đếm UTF-16 trước NFC) mà không báo gì.
 */
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
  { value: "le", label: t("Khách lẻ"), moTa: t("Cá nhân mua để dùng") },
  { value: "si", label: t("Khách sỉ"), moTa: t("Cửa hàng, đại lý mua để bán lại") },
  { value: "doanh_nghiep", label: t("Doanh nghiệp"), moTa: t("Công ty mua theo báo giá") },
];
const LOAI_HOP_LE = LOAI_KHACH_HANG.map((loai) => loai.value);
export const LOAI_MAC_DINH_KHI_THEM = "le";

/** Thứ tự ô trên màn hình: bấm Lưu mà có lỗi thì con trỏ nhảy tới ô sai đầu tiên theo thứ tự này. */
// Khách sỉ / doanh nghiệp: Mã số thuế đứng trước Mã khách trên cùng một hàng.
export const THU_TU_O = ["loaiKhachHang", "tenKhachHang", "maSoThue", "maKhachHang", "nguoiLienHe", "soDienThoai", "email", "diaChi"];

/** Tên ô trong dòng "Đã sửa: …" ở chân popup. */
export const NHAN_O = {
  loaiKhachHang: t("Loại khách"),
  tenKhachHang: t("Tên"),
  maSoThue: t("Mã số thuế"),
  nguoiLienHe: t("Người liên hệ"),
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
// Tên khách lẻ (một người) và người liên hệ: như luật họ tên — chữ cái, dấu cách, ' ’ . -; mở đầu bằng chữ cái.
const TEN_NGUOI_REGEX = /^\p{L}[\p{L}\p{M} '’.-]*$/u;
// Tên khách sỉ / doanh nghiệp / chưa phân loại: thêm chữ số và & , ( ) / ("Công ty TNHH 3A", "Shop A&B").
// Mở đầu bằng chữ hoặc số nên không mở đầu bằng = + - @ (xuất Excel không thành công thức).
const TEN_TO_CHUC_REGEX = /^[\p{L}0-9][\p{L}\p{M}0-9 &,.()/'’-]*$/u;
const MO_DAU_TO_CHUC_REGEX = /^[\p{L}0-9]/u;
const CO_CHU_CAI_REGEX = /\p{L}/u;
// Như nhà cung cấp: di động 10 số (03/05/07/08/09), máy bàn 11 số (02…), tổng đài 1800/1900.
// Khách lẻ là một người: không nhận số tổng đài (chỉ gọi vào, không nhắn tin, tra khách ở quầy theo số vô nghĩa).
const SO_DIEN_THOAI_REGEX = /^(0[35789][0-9]{8}|02[0-9]{9}|1[89]00[0-9]{4,6})$/;
const SO_DIEN_THOAI_KHACH_LE_REGEX = /^(0[35789][0-9]{8}|02[0-9]{9})$/;
const SO_TONG_DAI_REGEX = /^1[89]00[0-9]{4,6}$/;
// Số đang lưu là tổng đài: chuẩn hóa đúng như SoDienThoai.chuanHoa của máy chủ (chỉ bỏ khoảng trắng ASCII . ( ) -,
// "+84" về "0"), để số cũ có chữ kèm ("1900 1234 (CSKH)") không bị form chặn mà máy chủ lại cho qua.
const laSoTongDaiDangLuu = (sdt) => {
  const bo = String(sdt ?? "").replace(/[ \t\n\v\f\r.()-]/g, "");
  return SO_TONG_DAI_REGEX.test(bo.startsWith("+84") ? `0${bo.slice(3)}` : bo);
};
// Mã số thuế: luật ở validations/maSoThue.js (trùng utils/MaSoThue.java của backend).
export const MA_SO_THUE_MESSAGE = t("Mã số thuế gồm 10 số (đơn vị phụ thuộc thêm -3 số) hoặc 12 số");
export const MA_SO_THUE_SAI_SO = t("Mã số thuế không hợp lệ, kiểm tra lại từng chữ số");

export const CAN_LIEN_HE = t("Cần số điện thoại hoặc email để liên hệ khách hàng");
// Một dòng dưới ô nửa hộp; trùng banHang.soDienThoaiKhongHopLe / soDienThoaiKhachLeSai của máy chủ.
export const SO_DIEN_THOAI_MESSAGE = t("Nhập di động, máy bàn hoặc số 1800/1900");
export const SO_DIEN_THOAI_KHACH_LE_MESSAGE = t("Nhập di động 10 số hoặc máy bàn 11 số");

const gon = (value) => String(value ?? "").normalize("NFC").trim();
// Tên khách và người liên hệ chuẩn hóa như họ tên (NFC, bỏ ký tự vô hình, gộp khoảng trắng), như máy chủ lưu.
const O_TEN = ["tenKhachHang", "nguoiLienHe"];
const gonO = (name, value) => (O_TEN.includes(name) ? chuanHoaHoTen(value) : gon(value));
const soKyTu = (s) => [...s].length;

/** Câu lỗi của tên khách theo loại (chưa chuẩn hóa cũng được), "" khi hợp lệ. Dùng cả ở thêm nhanh khách tại quầy POS. */
export function loiTenKhachHang(value, loai) {
  const ten = chuanHoaHoTen(value);
  if (!ten) return t("Nhập tên khách hàng");
  const doDai = soKyTu(ten);
  if (doDai > MAX_LENGTH.tenKhachHang) return t("Tên khách hàng tối đa 200 ký tự");
  if (doDai < TEN_TOI_THIEU) return t("Tên khách hàng cần ít nhất {{toiThieu}} ký tự", { toiThieu: TEN_TOI_THIEU });
  if (loai === "le") return TEN_NGUOI_REGEX.test(ten) ? "" : t("Tên khách lẻ chỉ gồm chữ cái và dấu cách");
  if (!MO_DAU_TO_CHUC_REGEX.test(ten)) return t("Tên mở đầu bằng chữ hoặc số");
  if (!TEN_TO_CHUC_REGEX.test(ten)) return t("Tên chỉ gồm chữ, số và & , . ( ) / - '");
  if (!CO_CHU_CAI_REGEX.test(ten)) return t("Tên cần có ít nhất một chữ cái");
  return "";
}

/** Câu lỗi của người liên hệ (không bắt buộc), "" khi hợp lệ. */
function loiNguoiLienHe(value) {
  const ten = chuanHoaHoTen(value);
  if (!ten) return "";
  const doDai = soKyTu(ten);
  if (doDai > MAX_LENGTH.nguoiLienHe) return t("Người liên hệ tối đa 100 ký tự");
  if (doDai < TEN_TOI_THIEU) return t("Người liên hệ cần ít nhất {{toiThieu}} ký tự", { toiThieu: TEN_TOI_THIEU });
  return TEN_NGUOI_REGEX.test(ten) ? "" : t("Người liên hệ chỉ gồm chữ cái và dấu cách");
}

/**
 * Câu lỗi của số điện thoại đã chuẩn hóa (không trống) theo loại khách, "" khi hợp lệ. Mặc định khách lẻ
 * (thêm nhanh khách tại quầy POS); sỉ / doanh nghiệp / chưa phân loại nhận thêm tổng đài 1800/1900.
 */
export function loiSoDienThoai(sdt, loai = "le") {
  if (loai === "le") return SO_DIEN_THOAI_KHACH_LE_REGEX.test(gon(sdt)) ? "" : SO_DIEN_THOAI_KHACH_LE_MESSAGE;
  return SO_DIEN_THOAI_REGEX.test(gon(sdt)) ? "" : SO_DIEN_THOAI_MESSAGE;
}

/** Gõ / dán số điện thoại: bỏ khoảng trắng, dấu chấm, gạch, ngoặc; "+84…" đổi về "0…"; chỉ giữ chữ số. */
export function chuanHoaSoDienThoaiKhiNhap(value) {
  const bo = String(value ?? "").replace(/[\s.()-]/g, "");
  const doi = bo.startsWith("+84") ? `0${bo.slice(3)}` : bo;
  // Không cắt độ dài: dán thừa chữ số thì luật kiểm báo sai, không lặng lẽ thành một số khác.
  return doi.replace(/\D/g, "");
}

/** Gõ / dán mã số thuế: chỉ giữ chữ số và dấu gạch (mã đơn vị phụ thuộc "0312345678-001"). */
export const chuanHoaMaSoThueKhiNhap = (value) =>
  String(value ?? "").replace(/[^\d-]/g, "");

/** Mã nhập tay: viết hoa, không có khoảng trắng (không cắt độ dài: quá dài thì báo lỗi). */
export const chuanHoaMaKhiNhap = (value) => String(value ?? "").toUpperCase().replace(/\s/g, "");

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
  if (loai === "si") return t("VD: Cửa hàng Thời trang An Phát");
  if (loai === "doanh_nghiep") return t("VD: Công ty TNHH Thời trang Minh Khôi");
  return t("VD: Nguyễn Văn An");
}

/** Gợi ý dưới ô địa chỉ, khớp nhãn: doanh nghiệp là địa chỉ trụ sở (in trên hóa đơn), còn lại là địa chỉ giao hàng. */
export function goiYDiaChi(loai) {
  if (loai === "doanh_nghiep") return t("In trên hóa đơn và tự điền vào báo giá; sửa được ở từng báo giá.");
  return t("Tự điền vào báo giá; sửa được ở từng báo giá.");
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

/** Các ô đã sửa so với lúc mở (so sau khi chuẩn hóa); mã không sửa được nên không tính. */
export function cacOThayDoi(form, banDau) {
  return THU_TU_O.filter((name) => name !== "maKhachHang" && gonO(name, form[name]) !== gonO(name, banDau[name]));
}

/** Form thêm mới có gì khác trống không (để hỏi trước khi bỏ). */
export const formThemCoNhap = (form) => THU_TU_O.some((name) => gon(form[name]) !== gon(FORM_THEM[name]));

/**
 * Kiểm tra cả form; trả { tenO: câu báo lỗi }. Sửa: số điện thoại / email / địa chỉ không đổi thì không kiểm lại
 * (dữ liệu cũ không chặn việc sửa ô khác), giống backend. Số điện thoại kiểm theo loại khách.
 */
export function kiemTraForm(form, { laSua = false, banDau = FORM_THEM } = {}) {
  const loi = {};
  const giuNguyen = (name) => laSua && gonO(name, form[name]) === gonO(name, banDau[name]);

  // Tên: kiểm lại cả khi đổi sang Khách lẻ (khẳng định đây là một người; đổi sang sỉ / doanh nghiệp thì luật chỉ nới
  // ra); tên cũ không đổi gì thì không chặn việc sửa ô khác. Xóa trắng tên thì luôn báo. Như máy chủ.
  const ten = chuanHoaHoTen(form.tenKhachHang);
  const doiSangKhachLe = form.loaiKhachHang === "le" && !giuNguyen("loaiKhachHang");
  if (!ten) loi.tenKhachHang = t("Nhập tên khách hàng");
  else if (!giuNguyen("tenKhachHang") || doiSangKhachLe) {
    const loiTen = loiTenKhachHang(ten, form.loaiKhachHang);
    if (loiTen) loi.tenKhachHang = loiTen;
  }

  if (!laSua) {
    const ma = gon(form.maKhachHang);
    if (ma.length > MAX_LENGTH.maKhachHang) loi.maKhachHang = t("Mã khách hàng tối đa 50 ký tự");
    else if (ma && !MA_REGEX.test(ma)) loi.maKhachHang = t("Mã gồm chữ không dấu, số và . _ -, mở đầu bằng chữ hoặc số");
  }

  const maSoThue = gon(form.maSoThue);
  if (maSoThue && !giuNguyen("maSoThue")) {
    if (!maSoThueDungDang(maSoThue)) loi.maSoThue = MA_SO_THUE_MESSAGE;
    else if (!maSoThueHopLe(maSoThue)) loi.maSoThue = MA_SO_THUE_SAI_SO;
  }

  if (!giuNguyen("nguoiLienHe")) {
    const loiLienHe = loiNguoiLienHe(form.nguoiLienHe);
    if (loiLienHe) loi.nguoiLienHe = loiLienHe;
  }

  const sdt = gon(form.soDienThoai);
  const email = gon(form.email);
  if (sdt && !giuNguyen("soDienThoai")) {
    const loiSdt = loiSoDienThoai(sdt, form.loaiKhachHang);
    if (loiSdt) loi.soDienThoai = loiSdt;
  } else if (sdt && doiSangKhachLe && laSoTongDaiDangLuu(sdt)) {
    // Đổi sang Khách lẻ mà giữ số tổng đài: chặn như số mới (số cũ định dạng khác thì không chặn), như máy chủ.
    loi.soDienThoai = SO_DIEN_THOAI_KHACH_LE_MESSAGE;
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
    loaiKhachHang: form.loaiKhachHang || LOAI_MAC_DINH_KHI_THEM,
    maSoThue: tuyChon(form.maSoThue),
    nguoiLienHe: chuanHoaHoTen(form.nguoiLienHe) || null,
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
    payload[name] = gonO(name, form[name]);
  });
  return payload;
}

// Đầu câu báo lỗi của máy chủ (câu gốc tiếng Việt, viết thường) → ô. Chỉ để tra cứu, không hiện ra giao diện.
const DAU_CAU_MAY_CHU = [
  ["mã khách hàng", "maKhachHang"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["mã số thuế", "maSoThue"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["tên ", "tenKhachHang"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["người liên hệ", "nguoiLienHe"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["cần số điện thoại hoặc email", "soDienThoai"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["nhập di động", "soDienThoai"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["số điện thoại", "soDienThoai"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["email", "email"],
  ["địa chỉ", "diaChi"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
  ["loại khách", "loaiKhachHang"], // i18n-giu-nguyen: tra cứu câu gốc của máy chủ
];

/** Câu báo lỗi của máy chủ → ô tương ứng, để hiện ngay dưới ô đó; không nhận ra ô thì null. */
export function oCuaThongBaoMayChu(message) {
  // Dò trên câu gốc tiếng Việt (giao diện tiếng Anh nhận câu đã dịch)
  const text = String(cauGocMayChu(message) ?? "").toLocaleLowerCase("vi-VN");
  // Xét đầu câu trước: câu trùng có chèn tên khách ("Email đã thuộc khách hàng Nguyễn Số…"), dò "chứa" có thể nhầm ô.
  const theoDauCau = DAU_CAU_MAY_CHU.find(([dau]) => text.startsWith(dau));
  if (theoDauCau) return theoDauCau[1];
  if (text.includes("mã khách hàng")) return "maKhachHang";
  if (text.includes("mã số thuế")) return "maSoThue";
  if (text.includes("tên khách hàng")) return "tenKhachHang";
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
  if (name === "email") return t("Email này đã thuộc khách hàng {{ai}}", { ai });
  if (name === "maSoThue") return t("Mã số thuế này đã thuộc khách hàng {{ai}}", { ai });
  return t("Số này đã thuộc khách hàng {{ai}}", { ai });
}

/** Có cần hỏi máy chủ xem số / email / mã số thuế đã thuộc khách khác chưa: có giá trị, hợp lệ, và (khi sửa) đã đổi. */
export function canKiemTrung(name, form, { laSua = false, banDau = FORM_THEM } = {}) {
  const giaTri = gon(form[name]);
  if (!giaTri) return false;
  if (laSua && giaTri === gon(banDau[name])) return false;
  const loi = kiemTraForm(form, { laSua, banDau })[name];
  return !loi;
}
