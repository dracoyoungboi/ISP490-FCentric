import apiClient from "./apiClient";

/**
 * Báo cáo doanh thu: doanh thu kèm cùng kỳ năm trước, tiền thu trong kỳ, tệp Excel. Tham số chung: loai (ngay | thang |
 * nam), tuNgay / denNgay (yyyy-MM-dd, theo ngày), nam (theo tháng), tuNam / denNam (theo năm), khoId (trống = tất cả kho
 * được xem). Quản lý kho chỉ xem các cửa hàng mình phụ trách.
 */
const BASE = "/api/v1/admin/dashboard/bao-cao";
const sach = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ""));

export const baoCaoDoanhThuService = {
  async tongHop(params, { signal } = {}) {
    const res = await apiClient.get(`${BASE}/doanh-thu/tong-hop`, { params: sach(params), signal, needKho: false });
    return res.data?.data ?? null;
  },

  async tienThu(params, { signal } = {}) {
    const res = await apiClient.get(`${BASE}/tien-thu`, { params: sach(params), signal, needKho: false });
    return res.data?.data ?? null;
  },

  /** Tệp .xlsx (phản hồi axios: data là Blob, header Content-Disposition có tên tệp). Gửi kèm kho làm việc: máy chủ kiểm quyền Xuất báo cáo ở kho này. */
  async xuatExcel(params) {
    return apiClient.get(`${BASE}/doanh-thu/xuat-excel`, { params: sach(params), responseType: "blob" });
  },
};
