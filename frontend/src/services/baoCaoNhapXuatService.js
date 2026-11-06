import apiClient from "./apiClient";

/**
 * Báo cáo nhập xuất: tồn đầu kỳ + nhập − xuất = tồn cuối kỳ, nhập từ đâu, xuất đi đâu, theo kỳ, kho, sản phẩm; tệp Excel.
 * Tham số: loai (ngay | tuan | thang | nam), tuNgay / denNgay (yyyy-MM-dd, theo ngày), nam (theo tuần, tháng), tuNam /
 * denNam (theo năm), khoId (trống = mọi kho được xem; quản lý kho chỉ các kho mình phụ trách), nhom (lọc một loại).
 */
const BASE = "/api/v1/admin/dashboard/bao-cao/nhat-ky-nhap-xuat";
const sach = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ""));

export const baoCaoNhapXuatService = {
  async tongHop(params, { signal } = {}) {
    const res = await apiClient.get(`${BASE}/tong-hop`, { params: sach(params), signal, needKho: false });
    return res.data?.data ?? null;
  },

  /** Tệp .xlsx (phản hồi axios: data là Blob). Gửi kèm kho làm việc: máy chủ kiểm quyền Xuất báo cáo ở kho này. */
  async xuatExcel(params) {
    return apiClient.get(`${BASE}/xuat-excel`, { params: sach(params), responseType: "blob" });
  },
};
