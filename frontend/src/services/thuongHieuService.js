import apiClient from "./apiClient";

/**
 * Tất cả API đều trả về:
 * { status, data, message, error }
 */
export const thuongHieuService = {
  async filter(payload) {
    const res = await apiClient.post("/api/v1/thuong-hieu/filter", payload);
    return res.data; // ResponseData<Page<ThuongHieuDto>>
  },

  async getAll() {
    const res = await apiClient.get("/api/v1/thuong-hieu/all");
    return res.data; // ResponseData<List<ThuongHieuDto>>
  },

  async create(payload) {
    const res = await apiClient.post("/api/v1/thuong-hieu", payload);
    return res.data; // ResponseData<ThuongHieuDto>
  },

  async update(id, payload) {
    const res = await apiClient.put(`/api/v1/thuong-hieu/${id}`, payload);
    return res.data; // ResponseData<ThuongHieuDto>
  },

  async uploadLogo(id, file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post(`/api/v1/thuong-hieu/${id}/logo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data; // ResponseData<ThuongHieuDto>
  },
};
