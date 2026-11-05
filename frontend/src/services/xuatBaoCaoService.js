import apiClient from "./apiClient";

/**
 * Tệp Excel (.xlsx; phản hồi axios, data là Blob) của Báo cáo khách hàng. Tham số là chuỗi truy vấn trang đã dùng để tải
 * số liệu đang xem (URLSearchParams.toString()), để tệp đúng với màn. Gửi kèm kho làm việc: máy chủ kiểm quyền Xuất báo
 * cáo ở kho này.
 */
const tai = (duongDan, chuoiThamSo) =>
  apiClient.get(duongDan, { params: Object.fromEntries(new URLSearchParams(chuoiThamSo)), responseType: "blob" });

export const xuatBaoCaoService = {
  khachHang: (chuoiThamSo) => tai("/api/v1/admin/dashboard/bao-cao/khach-hang/xuat-excel", chuoiThamSo),
};

/** Tên tệp lưu về máy (không dấu): tiền tố + mốc thời gian trong chuỗi tham số. */
export function tenTepTheoThamSo(tienTo, chuoiThamSo) {
  const p = new URLSearchParams(chuoiThamSo);
  const loai = p.get("loai");
  let hau;
  if (p.get("tuNgay") && p.get("denNgay")) hau = `${p.get("tuNgay")}_${p.get("denNgay")}`;
  else if (loai === "nam") hau = `${p.get("tuNam")}-${p.get("denNam")}`;
  else if (loai === "so_sanh") hau = `${p.get("nam")}-${String(p.get("thang")).padStart(2, "0")}`;
  else hau = p.get("nam") ?? "";
  return `${tienTo}_${hau}.xlsx`;
}
