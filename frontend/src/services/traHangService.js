import apiClient from "./apiClient";

/**
 * API trả hàng tại quầy (/api/v1/pos/returns) — đặc tả BA "Trả hàng / Đổi hàng tại POS".
 * Mọi hàm trả phần data của envelope; lỗi để apiClient / nơi gọi xử lý (getApiErrorMessage).
 */
export const traHangService = {
  /** Tìm hóa đơn POS gốc theo mã hóa đơn hoặc số điện thoại khách tại cửa hàng nhận khoId. */
  async tim(khoId, q, { signal } = {}) {
    const res = await apiClient.get("/api/v1/pos/returns/search", { params: { khoId, q }, signal });
    return res.data?.data ?? [];
  },

  /** Khối thông tin đơn gốc + các dòng còn trả được, kệ của cửa hàng nhận, duyệt quá hạn đang hiệu lực. */
  async donGoc(donBanHangId, khoId, { signal } = {}) {
    const res = await apiClient.get(`/api/v1/pos/returns/orders/${donBanHangId}`, { params: { khoId }, signal });
    return res.data?.data ?? null;
  },

  /** Gửi mã PIN duyệt quá hạn tới email quản lý cửa hàng. */
  async guiYeuCauDuyet({ donBanHangId, khoId, lyDo }) {
    const res = await apiClient.post("/api/v1/pos/returns/approval-requests", { donBanHangId, khoId, lyDo });
    return res.data?.data ?? null;
  },

  /** Nhập mã PIN quản lý đọc cho. */
  async nhapMaDuyet(yeuCauId, ma) {
    const res = await apiClient.post(`/api/v1/pos/returns/approval-requests/${yeuCauId}/verify`, { ma });
    return res.data?.data ?? null;
  },

  /**
   * Xác nhận hoàn trả. requestId do quầy sinh và GIỮ NGUYÊN khi gửi lại sau lỗi mạng: máy chủ trả đúng phiếu đã lập,
   * không trả hàng hai lần.
   */
  async xacNhan(payload) {
    const res = await apiClient.post("/api/v1/pos/returns", payload, { timeout: 30000 });
    return { data: res.data?.data ?? null, message: res.data?.message ?? null };
  },

  /** Biên bản trả hàng để in 02 liên. */
  async phieu(id, { signal } = {}) {
    const res = await apiClient.get(`/api/v1/pos/returns/${id}`, { signal });
    return res.data?.data ?? null;
  },
};

export const newReturnRequestId = () => (
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ret-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);
