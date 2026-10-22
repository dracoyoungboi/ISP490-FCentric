import apiClient from "./apiClient";

const BASE = "/api/v1/dong-goi";

/**
 * Đóng gói đơn bán (Scan-to-Pack) — DongGoiController. Header kho_id do apiClient tự gửi.
 * Mọi hàm trả về phiên đóng gói (PhienDongGoiDto): phiếu xuất của đơn và tiến độ quét từng dòng.
 */
export const dongGoiService = {
  async layPhien(donBanHangId) {
    const res = await apiClient.get(`${BASE}/don/${donBanHangId}`);
    return res.data?.data;
  },
  async quet(phieuXuatKhoId, { barcode, soLuong }) {
    const res = await apiClient.post(`${BASE}/phieu/${phieuXuatKhoId}/quet`, { barcode, soLuong });
    return res.data?.data;
  },
  async hoanTat(phieuXuatKhoId) {
    const res = await apiClient.post(`${BASE}/phieu/${phieuXuatKhoId}/hoan-tat`);
    return res.data?.data;
  },
  async layBangChung(donBanHangId) {
    const res = await apiClient.get(`${BASE}/don/${donBanHangId}/bang-chung`);
    return res.data?.data;
  },
  /**
   * `onUploadProgress(suKien)`: tiến độ gửi tệp của axios (`loaded`, `total`), để hiện phần trăm khi tải video.
   * `signal`: AbortSignal để dừng tải khi rời màn.
   */
  async uploadBangChung(donBanHangId, formData, { onUploadProgress, signal } = {}) {
    const res = await apiClient.post(`${BASE}/don/${donBanHangId}/bang-chung`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
      signal,
    });
    return res.data?.data;
  },
  async xoaBangChung(bangChungId) {
    const res = await apiClient.delete(`${BASE}/bang-chung/${bangChungId}`);
    return res.data?.data;
  },
};
