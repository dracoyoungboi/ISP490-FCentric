import { LY_DO_DOI_GIA, SO_SAN_PHAM_MOI_TRANG } from "./nhomGiaBan.js";

/**
 * Lựa chọn của màn "Giá bán & tem mã vạch" nhớ trong trình duyệt (riêng màn này): số sản phẩm mỗi trang, chế độ
 * "Mở tất cả", lý do đổi giá dùng lần trước. Trình duyệt chặn lưu (cửa sổ riêng tư…) thì vẫn dùng được, chỉ không nhớ.
 */
const KHOA_SO_DONG = "fc:gia-ban-tem:so-dong";
const KHOA_MO_TAT_CA = "fc:gia-ban-tem:mo-tat-ca";
const KHOA_LY_DO = "fc:gia-ban-tem:ly-do";

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

export function lyDoDaNho() {
  const lyDo = docNho(KHOA_LY_DO);
  return LY_DO_DOI_GIA.includes(lyDo) ? lyDo : LY_DO_DOI_GIA[0];
}
export const nhoLyDo = (lyDo) => ghiNho(KHOA_LY_DO, lyDo);
