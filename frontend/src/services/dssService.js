import apiClient from "@/services/apiClient";

const dssService = {
  getWarehouses: () => apiClient.get("/api/v1/dss/replenishment/warehouses"),
  getRecommendations: (khoId) =>
    apiClient.get("/api/v1/dss/replenishment/recommendations", {
      params: khoId ? { khoId } : undefined,
    }),
  updateConfig: (payload) => apiClient.put("/api/v1/dss/replenishment/config", payload),
  recalculate: (khoId) =>
    apiClient.post("/api/v1/dss/replenishment/recalculate", null, {
      params: khoId ? { khoId } : undefined,
    }),
};

export default dssService;

