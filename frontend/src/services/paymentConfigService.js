import apiClient from "./apiClient";

const BASE = "/api/v1/cau-hinh-thanh-toan/payos";

/**
 * Cài đặt thanh toán payOS (chỉ quản trị viên). Backend KHÔNG bao giờ trả khóa thật,
 * chỉ trả dạng che (ed71••••••••0ec63). Gửi khóa rỗng = giữ khóa đang lưu.
 */
export const paymentConfigService = {
  async getPayos() {
    const res = await apiClient.get(BASE);
    return res.data?.data ?? null;
  },

  async updatePayos(payload) {
    const res = await apiClient.put(BASE, payload);
    return res.data?.data ?? null;
  },

  async testConnection() {
    const res = await apiClient.post(`${BASE}/kiem-tra-ket-noi`);
    return res.data?.data ?? null;
  },

  async confirmWebhook(webhookUrl) {
    const res = await apiClient.post(`${BASE}/dang-ky-webhook`, { webhookUrl });
    return res.data?.data ?? null;
  },
};
