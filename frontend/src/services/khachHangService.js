// src/services/khachHangService.js
import apiClient from "./apiClient";  // Giữ nguyên import

export const getKhachHangById = async (id) => {
  // Endpoint hồ sơ giữ đủ các trường cho màn hình chi tiết và chỉnh sửa.
  const response = await apiClient.get(`/api/v1/khach-hang/get-by-id/${id}`);
  return response.data.data;
};

export const getKhachHangPurchaseHistory = async (id, { signal } = {}) => {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) > 2147483647) {
    throw new Error("ID khách hàng không hợp lệ.");
  }
  const response = await apiClient.get(`/api/v1/khach-hang/${id}`, { signal });
  const body = response.data;
  if (body?.status !== 200 && Number.isInteger(body?.status)) {
    const failure = new Error(body.message || "Không thể tải lịch sử mua hàng.");
    failure.status = body.status;
    throw failure;
  }
  if (!body?.data || (body.data.id != null && Number(body.data.id) !== Number(id))) {
    throw new Error("Dữ liệu lịch sử mua hàng trả về không hợp lệ.");
  }
  // Thiếu trường không đồng nghĩa với khách hàng chưa mua hàng.
  if (!Object.hasOwn(body.data, "lichSuMuaHang")) {
    const failure = new Error("Không đọc được lịch sử mua hàng. Vui lòng thử lại sau.");
    failure.code = "PURCHASE_HISTORY_UNAVAILABLE";
    throw failure;
  }
  const history = body.data.lichSuMuaHang;
  if (!Array.isArray(history) || history.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error("Dữ liệu lịch sử mua hàng trả về không hợp lệ.");
  }
  const totalOrders = body.data.tongSoDonHang;
  if (!Number.isSafeInteger(totalOrders) || totalOrders < history.length) {
    throw new Error("Tổng số đơn hàng trả về không hợp lệ.");
  }
  if (history.length === 0 && totalOrders > 0) {
    const failure = new Error("API ghi nhận có đơn hàng nhưng chưa trả dữ liệu lịch sử mua hàng.");
    failure.code = "PURCHASE_HISTORY_UNAVAILABLE";
    throw failure;
  }
  return { history, totalOrders };
};

/**
 * Số tổng hợp đơn bán của khách cho trang chi tiết (tổng chi tiêu, số đơn, trung bình, đơn gần nhất, kênh mua).
 * Cùng phạm vi vai trò với danh sách đơn bán ở máy chủ.
 */
export const getTongQuanMuaHang = async (id) => {
  const response = await apiClient.get(`/api/v1/khach-hang/${id}/tong-quan-mua-hang`);
  return response.data.data;
};

/** Ngừng hoạt động (0) / cho phép hoạt động lại (1); chỉ gửi trạng thái, các trường khác giữ nguyên. */
export const capNhatTrangThaiKhachHang = async (id, trangThai) => {
  const response = await apiClient.put(`/api/v1/khach-hang/${id}`, { trangThai });
  return response.data.data;
};

export const updateKhachHang = async (id, values) => {
  const response = await apiClient.put(`/api/v1/khach-hang/${id}`, values);  // ← Thêm /api/
  return response.data.data;
};
