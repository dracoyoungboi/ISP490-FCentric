import apiClient from "./apiClient";

const BASE_URL = "/api/v1/dieu-hanh-he-thong/cau-hinh";

function readConfigList(response) {
  const body = response.data;
  if (body?.status !== 200 || !Array.isArray(body.data)) {
    const error = new Error(body?.message || "Dữ liệu cấu hình trả về không hợp lệ.");
    error.response = response;
    throw error;
  }
  return body;
}

export async function getInventorySettings({ signal } = {}) {
  const response = await apiClient.get(BASE_URL, { signal, needKho: false });
  return readConfigList(response).data;
}

export async function bulkUpdateInventorySettings(changes) {
  // BE tự lấy userId từ HttpServletRequest; FE chỉ gửi đúng BulkUpdateRequest.
  const response = await apiClient.put(BASE_URL + "/bulk", changes, { needKho: false });
  return readConfigList(response);
}
