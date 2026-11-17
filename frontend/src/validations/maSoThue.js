// Mã số thuế Việt Nam. Cùng luật với máy chủ (backend utils/MaSoThue.java); sửa một bên thì sửa cả bên kia.
// - Doanh nghiệp, tổ chức: 10 chữ số; chữ số thứ 10 là số kiểm tra của 9 chữ số đầu
//   (trọng số 31, 29, 23, 19, 17, 13, 7, 5, 3; số kiểm tra = 10 − tổng mod 11).
// - Đơn vị phụ thuộc (chi nhánh): 10 chữ số của đơn vị chủ quản + "-" + 3 chữ số từ 001 đến 999.
// - Cá nhân, hộ kinh doanh: số định danh 12 chữ số; 3 số đầu là mã tỉnh nơi đăng ký khai sinh (001–096).

const DANG = /^(\d{10})(-(\d{3}))?$|^(\d{12})$/;
const TRONG_SO = [31, 29, 23, 19, 17, 13, 7, 5, 3];
const MA_TINH_TOI_DA = 96;

/** Đúng dạng 10 số, 10 số + "-3 số" hoặc 12 số (chưa xét số kiểm tra). */
export const maSoThueDungDang = (giaTri) => DANG.test(String(giaTri ?? ""));

/** Chữ số thứ 10 khớp số kiểm tra tính từ 9 chữ số đầu. */
function dungSoKiemTra(muoiSo) {
  const tong = TRONG_SO.reduce((cong, trongSo, i) => cong + Number(muoiSo[i]) * trongSo, 0);
  const soKiemTra = 10 - (tong % 11);
  return soKiemTra < 10 && soKiemTra === Number(muoiSo[9]);
}

/** Đúng dạng và đúng số kiểm tra / hậu tố / mã tỉnh. */
export function maSoThueHopLe(giaTri) {
  const m = DANG.exec(String(giaTri ?? ""));
  if (!m) return false;
  if (m[4]) {
    const maTinh = Number(m[4].slice(0, 3));
    return maTinh >= 1 && maTinh <= MA_TINH_TOI_DA;
  }
  if (m[3] && Number(m[3]) === 0) return false;
  return dungSoKiemTra(m[1]);
}
