// Phần tính thuần của Báo cáo khách hàng (không gọi máy chủ, không React).

/** Năm sớm nhất trong ô chọn năm. */
export const NAM_DAU = 2020;

/** Đơn vị kỳ theo kiểu báo cáo, dùng trong câu mô tả bảng. */
const DON_VI_KY = { ngay: "ngày", tuan: "tuần", thang: "tháng", nam: "năm", so_sanh: "tháng" };

/** Các năm cho ô chọn năm: mới nhất trước, từ năm nay về NAM_DAU. */
export function cacNam(homNay = new Date()) {
  const ds = [];
  for (let y = homNay.getFullYear(); y >= NAM_DAU; y--) ds.push(y);
  return ds;
}

/** Các tháng chọn được của một năm: năm nay chỉ tới tháng hiện tại. */
export function cacThang(nam, homNay = new Date()) {
  const toi = Number(nam) === homNay.getFullYear() ? homNay.getMonth() + 1 : 12;
  return Array.from({ length: toi }, (_, i) => i + 1);
}

/** Kỳ có ít nhất một khách mua (bảng chi tiết chỉ hiện các kỳ này). */
export function kyCoDon(ky) {
  return (ky ?? []).filter((k) => !k.chuaToi && Number(k.tongKhachMua) > 0);
}

/** Mô tả dưới tiêu đề bảng: "4 tháng có đơn · 6 tháng không có đơn". Kỳ chưa tới không đếm. */
export function moTaBangKy(ky, loai) {
  const daToi = (ky ?? []).filter((k) => !k.chuaToi);
  const co = kyCoDon(ky).length;
  const khong = daToi.length - co;
  const dv = DON_VI_KY[loai] ?? "kỳ";
  if (daToi.length === 0) return "";
  return khong > 0 ? `${co} ${dv} có đơn · ${khong} ${dv} không có đơn` : `${co} ${dv} có đơn`;
}

/** % khách quay lại trong tổng khách mua của một kỳ, làm tròn số nguyên; null khi không có khách. */
export function tyLeQuayLai(soQuayLai, tongKhach) {
  const tong = Number(tongKhach) || 0;
  if (tong === 0) return null;
  return Math.round(((Number(soQuayLai) || 0) / tong) * 100);
}

/** Chi tiêu trung bình mỗi khách (đồng, làm tròn); null khi không có khách. */
export function chiTieuTrungBinh(tong) {
  const khach = Number(tong?.khachMua) || 0;
  if (khach === 0) return null;
  return Math.round((Number(tong?.doanhThu) || 0) / khach);
}

/** "29/12 – 04/01" từ hai ngày yyyy-MM-dd (dùng cho nhãn tuần). */
export function khoangNgayNgan(tu, den) {
  const ngan = (s) => (typeof s === "string" && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");
  return tu && den ? `${ngan(tu)} – ${ngan(den)}` : "";
}

/** "05/10/2026" từ yyyy-MM-dd; trống thì "—". */
export function ngayVN(s) {
  return typeof s === "string" && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—";
}
