import apiClient from "@/services/apiClient";

const omnichannelAnalyticsService = {
  getOverview: (range = "24h", channel = "ALL") =>
    apiClient.get("/api/v1/omnichannel/analytics/overview", {
      params: { range, channel },
    }),
  getSyncRecommendations: (days = 14, channel = "ALL") =>
    apiClient.get("/api/v1/omnichannel/analytics/sync-recommendations", {
      params: { days, channel },
    }),
  applyRecommendations: (items) =>
    apiClient.post("/api/v1/omnichannel/analytics/apply-recommendations", { items }),
};

export default omnichannelAnalyticsService;

