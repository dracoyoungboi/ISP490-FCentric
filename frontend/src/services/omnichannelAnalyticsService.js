import apiClient from "@/services/apiClient";

/**
 * Axios Client cho Màn 2 (DSS Báo cáo Đồng bộ Kênh — /channels/analytics).
 * Đích Backend: OmnichannelAnalyticsController (/api/v1/omnichannel/analytics).
 */
const omnichannelAnalyticsService = {
  // Tab Overview (GET): lấy KPI độ trễ, tỷ lệ lỗi, hạn mức API & Oversell trong 1h / 24h / 7d
  getOverview: (range = "24h", channel = "ALL") =>
    apiClient.get("/api/v1/omnichannel/analytics/overview", {
      params: { range, channel },
    }),
  // Tab Đề xuất (GET): lấy gợi ý Buffer% & ngưỡng đồng bộ tức thời theo tỷ trọng bán POS vs Online
  getSyncRecommendations: (days = 14, channel = "ALL") =>
    apiClient.get("/api/v1/omnichannel/analytics/sync-recommendations", {
      params: { days, channel },
    }),
  // Nút "Áp dụng đề xuất" (POST - Admin): lưu Buffer% & Threshold_RT vào `trang_thai_dong_bo_san_pham`
  applyRecommendations: (items) =>
    apiClient.post("/api/v1/omnichannel/analytics/apply-recommendations", { items }),
};

export default omnichannelAnalyticsService;

