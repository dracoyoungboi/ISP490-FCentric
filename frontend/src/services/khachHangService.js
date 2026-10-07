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
  if (body?.status !== 200 || !body.data || Number(body.data.id) !== Number(id)) {
    throw new Error("Dữ liệu lịch sử mua hàng trả về không hợp lệ.");
  }
  // BE đang chạy trả KhachHangDto (hồ sơ), chưa có DTO/endpoint lịch sử.
  // Thiếu trường không đồng nghĩa với khách hàng chưa mua hàng.
  if (!Object.hasOwn(body.data, "lichSuMuaHang")) {
    const failure = new Error("API đang chạy chỉ trả hồ sơ khách hàng, chưa có dữ liệu lịch sử mua hàng.");
    failure.code = "PURCHASE_HISTORY_UNAVAILABLE";
    throw failure;
  }
  const history = body.data.lichSuMuaHang;
  if (!Array.isArray(history) || history.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error("Dữ liệu lịch sử mua hàng trả về không hợp lệ.");
  }
  return history;
};

export const updateKhachHang = async (id, values) => {
  const response = await apiClient.put(`/api/v1/khach-hang/${id}`, values);  // ← Thêm /api/
  return response.data.data;
};
