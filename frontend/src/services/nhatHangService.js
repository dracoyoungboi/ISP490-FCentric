import apiClient from "./apiClient";
import { PICKLIST_MOCK } from "@/mocks/mockHelpers";
import { nhatHangMock } from "@/mocks/nhatHangMock";

const BASE = "/api/v1/nhat-hang";

/**
 * Pick List — ĐÃ CÓ backend (NhatHangController). Header kho_id do apiClient tự gửi.
 * Chỉ khi đặt VITE_PICKLIST_MOCK=true mới chạy dữ liệu mẫu (demo không cần backend).
 */
const realService = {
  async getDonChoXuat(filter) {
    const res = await apiClient.post(`${BASE}/don-cho-xuat`, filter);
    return res.data?.data;
  },
  async taoPickList(payload) {
    const res = await apiClient.post(`${BASE}/tao-pick-list`, payload);
    return res.data?.data;
  },
  async getPickLists(params) {
    const res = await apiClient.get(`${BASE}/pick-list`, { params: { sort: "ngayTao,desc", ...params } });
    return res.data?.data;
  },
  async getPickList(id) {
    const res = await apiClient.get(`${BASE}/pick-list/${id}`);
    return res.data?.data;
  },
  async phanCong(id, payload) {
    const res = await apiClient.put(`${BASE}/pick-list/${id}/phan-cong`, payload);
    return res.data?.data;
  },
  async quetBarcode(id, payload) {
    const res = await apiClient.post(`${BASE}/pick-list/${id}/quet-barcode`, payload);
    return res.data?.data;
  },
  async hoanTat(id) {
    const res = await apiClient.post(`${BASE}/pick-list/${id}/hoan-tat`);
    return res.data?.data;
  },
  /**
   * Nhân viên có thể nhận Pick List: nhân viên kho và quản lý kho đang hoạt động.
   * POST /api/v1/nguoi-dung/filter cho phép quản trị viên và quản lý kho (NguoiDungController).
   */
  async getNguoiNhat() {
    const byRole = (vaiTro) =>
      apiClient.post("/api/v1/nguoi-dung/filter", {
        page: 0,
        size: 200,
        filters: [
          { fieldName: "vaiTro", operation: "EQUALS", value: vaiTro, logicType: "AND" },
          { fieldName: "trangThai", operation: "EQUALS", value: 1, logicType: "AND" },
        ],
        sorts: [{ fieldName: "hoTen", direction: "ASC" }],
      });
    const results = await Promise.all([byRole("nhan_vien_kho"), byRole("quan_ly_kho")]);
    const seen = new Set();
    return results
      .flatMap((res) => res.data?.data?.content ?? [])
      .filter((person) => (seen.has(person.id) ? false : seen.add(person.id)));
  },
};

export const nhatHangService = PICKLIST_MOCK ? nhatHangMock : realService;
export const isPickListMock = PICKLIST_MOCK;
