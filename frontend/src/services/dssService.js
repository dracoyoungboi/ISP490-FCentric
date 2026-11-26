import apiClient from "@/services/apiClient";

/**
 * Axios Client cho Màn 1 (DSS Gợi ý nhập hàng — /purchase-requests/dss).
 * Đích Backend: DssReplenishmentController (/api/v1/dss/replenishment).
 */
const dssService = {
  // Mở trang (GET): lấy danh sách kho đang hoạt động (trừ KHO_TRANSIT)
  getWarehouses: () => apiClient.get("/api/v1/dss/replenishment/warehouses"),
  // Mở trang (GET - chỉ đọc): tính và trả bảng gợi ý ABC / SS / ROP / Q toàn hệ thống
  getRecommendations: (khoId) =>
    apiClient.get("/api/v1/dss/replenishment/recommendations", {
      params: khoId ? { khoId } : undefined,
    }),
  // Nút "Lưu & Tính lại ROP" (PUT): lưu 12 tham số cấu hình và đồng bộ ngưỡng xuống bảng canh_bao
  updateConfig: (payload) => apiClient.put("/api/v1/dss/replenishment/config", payload),
  // Nút "Tính lại ngay" (POST): chạy lại thuật toán với dữ liệu bán/tồn mới nhất và ghi canh_bao
  recalculate: (khoId) =>
    apiClient.post("/api/v1/dss/replenishment/recalculate", null, {
      params: khoId ? { khoId } : undefined,
    }),
};

export default dssService;

