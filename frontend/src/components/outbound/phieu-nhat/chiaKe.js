import { toNumber } from "../../../constants/outbound.js";

/**
 * Chia số lấy từ một lô ra kệ trong hộp Phân bổ lô (phân bổ nhặt theo kệ, kiểm kê khoanh vùng 8.2).
 * `ke` của lô (LoKhaDungNhatHangDto.ke): `[{ viTriKhoId, maViTri, soLuong (còn lấy được), dangKiemKe }]`, kệ của lô
 * trước — cùng thứ tự máy chủ tự chia.
 */

const soNguyen = (v) => Math.max(0, Math.floor(toNumber(v)));

/** Tự chia như máy chủ: lần lượt các kệ, bỏ kệ đang kiểm kê, phần còn lại lấy ở hàng chưa có kệ. */
export function tuChiaKe(ke, soLuong) {
  let can = soNguyen(soLuong);
  const chia = [];
  (Array.isArray(ke) ? ke : []).forEach((k) => {
    if (can <= 0 || !k || k.dangKiemKe) return;
    const lay = Math.min(soNguyen(k.soLuong), can);
    if (lay > 0) {
      chia.push({ viTriKhoId: k.viTriKhoId, maViTri: k.maViTri, soLuong: lay });
      can -= lay;
    }
  });
  return { chia, chuaCoKe: can };
}

/** `[{ viTriKhoId, soLuong }]` → `{ [viTriKhoId]: "số" }` (ô nhập của chế độ chọn kệ). */
export function sangOKe(ds) {
  const o = {};
  (Array.isArray(ds) ? ds : []).forEach((v) => {
    if (v && v.viTriKhoId != null && soNguyen(v.soLuong) > 0) {
      o[v.viTriKhoId] = String((toNumber(o[v.viTriKhoId]) || 0) + soNguyen(v.soLuong));
    }
  });
  return o;
}

/** Hai cách chia (dạng ô nhập) có giống nhau không — để mở hộp đúng chế độ: giống tự chia thì để tự chia. */
export function giongNhau(a, b) {
  const ka = Object.keys(a || {}).filter((k) => toNumber(a[k]) > 0);
  const kb = Object.keys(b || {}).filter((k) => toNumber(b[k]) > 0);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => toNumber(a[k]) === toNumber(b?.[k]));
}

/**
 * Kiểm phần chọn kệ tay của một lô. `tay`: `{ [viTriKhoId]: "số" }`; `chuaCoKeCo`: hàng chưa có kệ của lô ở kho (null:
 * không biết). Trả `{ tongKe, chuaCoKe, loi, keVuot }`: `chuaCoKe` là phần còn lại lấy ở hàng chưa có kệ; `loi` là câu lỗi
 * đầu tiên (null khi hợp lệ); `keVuot` là tập id kệ nhập quá phần còn lấy được.
 */
export function kiemChiaTay({ maLo, soLuong, ke, tay, chuaCoKeCo }) {
  const ds = Array.isArray(ke) ? ke : [];
  const keVuot = new Set();
  let tongKe = 0;
  let loi = null;
  ds.forEach((k) => {
    const n = soNguyen(tay?.[k.viTriKhoId]);
    if (n <= 0) return;
    tongKe += n;
    if (k.dangKiemKe) {
      keVuot.add(k.viTriKhoId);
      loi = loi || `Kệ ${k.maViTri} đang được kiểm kê, chọn kệ khác`;
    } else if (n > soNguyen(k.soLuong)) {
      keVuot.add(k.viTriKhoId);
      loi = loi || `Kệ ${k.maViTri} chỉ còn ${soNguyen(k.soLuong)} của lô ${maLo} có thể lấy`;
    }
  });
  const lay = soNguyen(soLuong);
  const chuaCoKe = lay - tongKe;
  if (!loi && chuaCoKe < 0) loi = `Lô ${maLo}: tổng các kệ (${tongKe}) nhiều hơn số lấy từ lô (${lay})`;
  if (!loi && chuaCoKe > 0 && chuaCoKeCo != null && chuaCoKe > soNguyen(chuaCoKeCo)) {
    loi = `Lô ${maLo} chỉ có ${soNguyen(chuaCoKeCo)} ở hàng chưa có kệ, chọn thêm kệ cho phần còn lại`;
  }
  return { tongKe, chuaCoKe: Math.max(0, chuaCoKe), loi, keVuot };
}

/**
 * Tự chia mà phần còn lại vượt hàng chưa có kệ của lô (kệ đang kiểm kê hoặc phiếu khác đã giữ kệ): câu lỗi, không thì
 * null. `chuaCoKeCo` null (không biết): không kiểm.
 */
export function kiemTuChia({ maLo, soLuong, ke, chuaCoKeCo }) {
  if (chuaCoKeCo == null) return null;
  const { chuaCoKe } = tuChiaKe(ke, soLuong);
  if (chuaCoKe > soNguyen(chuaCoKeCo)) {
    return `Lô ${maLo} thiếu ${chuaCoKe - soNguyen(chuaCoKeCo)} chỗ lấy (kệ đang kiểm kê hoặc phiếu khác đã giữ). Giảm số của lô hoặc lấy lô khác`;
  }
  return null;
}

/** Phần `viTri` gửi máy chủ cho một lô chọn kệ tay: các kệ > 0, phần còn lại là hàng chưa có kệ (`viTriKhoId: null`). */
export function viTriGui(ke, tay, soLuong) {
  const ds = [];
  let tong = 0;
  (Array.isArray(ke) ? ke : []).forEach((k) => {
    const n = soNguyen(tay?.[k.viTriKhoId]);
    if (n > 0) {
      ds.push({ viTriKhoId: k.viTriKhoId, soLuong: n });
      tong += n;
    }
  });
  const con = soNguyen(soLuong) - tong;
  if (con > 0) ds.push({ viTriKhoId: null, soLuong: con });
  return ds;
}
