import apiClient from "./apiClient";

export const donBanHangService = {
  async filter(payload) {
    const res = await apiClient.post("/api/v1/don-ban-hang/filter", payload);
    return res.data?.data || res.data;
  },
  async getDetail(id) {
    const res = await apiClient.get(`/api/v1/don-ban-hang/${id}/detail`);
    return res.data;
  },
  async sendToWarehouse(id, payload) {
    const res = await apiClient.put(`/api/v1/don-ban-hang/${id}/send-to-warehouse`, payload);
    return res.data;
  },
  async getKhoKhaDung(id) {
    const res = await apiClient.get(`/api/v1/don-ban-hang/${id}/kho-kha-dung`);
    return res.data?.data || res.data;
  },
  async cancel(id) {
    const res = await apiClient.put(`/api/v1/don-ban-hang/${id}/cancel`);
    return res.data;
  },
  async create(payload) {
    const res = await apiClient.post("/api/v1/don-ban-hang/create", payload);
    return res.data;
  },
  getVariantsForCreate() {
    return apiClient.get("/api/v1/don-ban-hang/variants-for-create");
  },
  getCustomersForCreate() {
    return apiClient.get("/api/v1/khach-hang/for-sales-order");
  },
  async markAsDelivered(id) {
    const res = await apiClient.put(`/api/v1/don-ban-hang/${id}/mark-delivered`);
    return res.data;
  },
  async convertToOrder(id, payload) {
    const res = await apiClient.put(`/api/v1/don-ban-hang/${id}/convert-to-order`, payload);
    return res.data;
  },
  
  async rejectQuote(id, payload) {
    const res = await apiClient.put(`/api/v1/don-ban-hang/${id}/reject-quote`, payload);
    return res.data;
  },
  async returnOrder(id) {
    const res = await apiClient.put(`/api/v1/don-ban-hang/${id}/return`);
    return res.data;
  }
};