import apiClient from "./apiClient";
import { chuyenDanhSachThongBao } from "../utils/thongBaoChuong";

/**
 * Thông báo trên thanh trên cùng (chuông cạnh khối tài khoản): API /api/v1/thong-bao (ThongBaoController).
 * Chỉ thông báo của người đang đăng nhập: máy chủ lấy người nhận từ token, không cần kho đang chọn.
 * Hiện có thông báo phiếu chuyển kho (chờ duyệt, đã duyệt, bị từ chối / đã hủy, đang trên đường đến, nhận lệch);
 * máy chủ xóa thông báo cũ hơn 90 ngày.
 *
 * Một thông báo (sau chuyenDongThongBao ở utils/thongBaoChuong.js):
 *   id        số, duy nhất
 *   loai      mã loại, dùng để chọn biểu tượng (LOAI_THONG_BAO trong NotificationBell.jsx); loại lạ dùng hình chuông
 *   tone      "info" | "warning" | "danger" | "success": màu ô biểu tượng
 *   nhom      tên nhóm hiển thị, ví dụ "Chuyển kho"; có thể null
 *   tieuDe    một dòng
 *   moTa      tối đa hai dòng, có thể null
 *   duongDan  đường dẫn trong ứng dụng để mở khi bấm (vd. "/transfer-tickets/12"), có thể null
 *   thoiGian  chuỗi ISO 8601 (UTC, đuôi Z)
 *   daDoc     true | false, tính theo từng người dùng
 */
export const THONG_BAO_DA_SAN_SANG = true;

const GOC = "/api/v1/thong-bao";
const duLieu = (res) => res.data?.data ?? res.data;

/** Số thông báo mới nhất tải cho chuông mỗi lần. */
export const SO_THONG_BAO_MOI_LAN = 30;

export const thongBaoService = {
  /** → { items, soChuaDoc }: items mới nhất trước; soChuaDoc đếm mọi thông báo chưa đọc, không chỉ trang này. */
  layDanhSach: ({ chiChuaDoc = false, size = SO_THONG_BAO_MOI_LAN } = {}) =>
    apiClient
      .get(GOC, { params: { page: 0, size, chuaDoc: chiChuaDoc || undefined }, needKho: false })
      .then((res) => chuyenDanhSachThongBao(duLieu(res))),
  /** → { id, soChuaDoc }. Thông báo không còn (đã dọn sau 90 ngày) hoặc không phải của mình: lỗi 404. */
  danhDauDaDoc: (id) => apiClient.put(`${GOC}/${encodeURIComponent(id)}/da-doc`, null, { needKho: false }).then(duLieu),
  /** → { soDaDanhDau, soChuaDoc: 0 }. */
  danhDauTatCaDaDoc: () => apiClient.put(`${GOC}/da-doc-tat-ca`, null, { needKho: false }).then(duLieu),
};
