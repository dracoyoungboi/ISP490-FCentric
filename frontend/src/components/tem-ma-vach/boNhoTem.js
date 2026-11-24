import { SO_SAN_PHAM_MOI_TRANG } from "./nhomTem.js";

/**
 * Lựa chọn của màn "Tem mã vạch" nhớ trong trình duyệt (riêng màn này): số sản phẩm mỗi trang, chế độ "Mở tất cả".
 * Trình duyệt chặn lưu (cửa sổ riêng tư…) thì vẫn dùng được, chỉ không nhớ.
 */
const KHOA_SO_DONG = "fc:tem-ma-vach:so-dong";
const KHOA_MO_TAT_CA = "fc:tem-ma-vach:mo-tat-ca";

function docNho(khoa) {
  try {
    return window.localStorage.getItem(khoa);
  } catch {
    return null;
  }
}

function ghiNho(khoa, giaTri) {
  try {
    window.localStorage.setItem(khoa, String(giaTri));
  } catch {
    // Không lưu được: lần sau dùng mặc định
  }
}

export function soDongDaNho(macDinh) {
  const so = Number(docNho(KHOA_SO_DONG));
  return SO_SAN_PHAM_MOI_TRANG.includes(so) ? so : macDinh;
}
export const nhoSoDong = (so) => ghiNho(KHOA_SO_DONG, so);

export const moTatCaDaNho = () => docNho(KHOA_MO_TAT_CA) === "1";
export const nhoMoTatCa = (mo) => ghiNho(KHOA_MO_TAT_CA, mo ? "1" : "0");
