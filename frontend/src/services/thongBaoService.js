/**
 * Thông báo trên thanh trên cùng (chuông cạnh khối tài khoản).
 *
 * Backend CHƯA có API thông báo; nghiệp vụ (loại thông báo, ai nhận, khi nào tạo) chốt sau.
 * Trong lúc này chuông chỉ mở bảng "Tính năng thông báo đang được phát triển" và không gọi máy chủ.
 *
 * Khi có API:
 *   1. Thay `chuaCoApi` bằng lời gọi apiClient trả về đúng hình dạng bên dưới.
 *   2. Đổi THONG_BAO_DA_SAN_SANG thành true. Giao diện danh sách đã làm sẵn trong NotificationBell.jsx.
 *
 * Một thông báo:
 *   id        số hoặc chuỗi, duy nhất
 *   loai      mã loại, dùng để chọn biểu tượng (LOAI_THONG_BAO trong NotificationBell.jsx); loại lạ dùng hình chuông
 *   tone      "info" | "warning" | "danger" | "success": màu ô biểu tượng
 *   nhom      tên nhóm hiển thị, ví dụ "Kho", "Mua hàng"
 *   tieuDe    một dòng
 *   moTa      tối đa hai dòng, có thể bỏ trống
 *   duongDan  đường dẫn trong ứng dụng để mở khi bấm, có thể bỏ trống
 *   thoiGian  chuỗi ISO 8601
 *   daDoc     true | false, tính theo từng người dùng
 */
export const THONG_BAO_DA_SAN_SANG = false;

const chuaCoApi = {
  layDanhSach: async () => [],
  danhDauDaDoc: async () => {},
  danhDauTatCaDaDoc: async () => {},
};

export const thongBaoService = chuaCoApi;
