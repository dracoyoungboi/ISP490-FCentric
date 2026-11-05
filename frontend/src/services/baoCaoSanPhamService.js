import apiClient from "./apiClient";

/**
 * Báo cáo sản phẩm: số bán, doanh thu hàng, giá vốn, hoàn theo sản phẩm và mã SKU, kèm khả dụng / đang về hiện tại.
 * Tham số: tuNgay, denNgay (yyyy-MM-dd, tối đa 1 năm), khoId (trống = mọi kho được xem), kenh (trống = mọi kênh, POS,
 * TRUC_TIEP hoặc id kênh bán). Quản lý kho chỉ xem các cửa hàng mình phụ trách.
 */
const BASE = "/api/v1/admin/dashboard/bao-cao/san-pham";
const sach = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ""));

export const baoCaoSanPhamService = {
  async lay(params, { signal } = {}) {
    const res = await apiClient.get(BASE, { params: sach(params), signal, needKho: false });
    return res.data?.data ?? null;
  },

  /** Tệp .xlsx (phản hồi axios: data là Blob, header Content-Disposition có tên tệp). Gửi kèm kho làm việc: máy chủ kiểm quyền Xuất báo cáo ở kho này. */
  async xuatExcel(params) {
    return apiClient.get(`${BASE}/xuat-excel`, { params: sach(params), responseType: "blob" });
  },
};
