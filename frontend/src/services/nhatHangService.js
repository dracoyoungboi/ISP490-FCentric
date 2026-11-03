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
  /** Lô chọn được cho một dòng phiếu nhặt, sắp FIFO (conLai đã trừ phần phiếu khác giữ, daPhanBo là phần của dòng). */
  async getLoKhaDung(id, chiTietId) {
    const res = await apiClient.get(`${BASE}/pick-list/${id}/chi-tiet/${chiTietId}/lo-kha-dung`);
    return res.data?.data;
  },
  /** Lưu phân bổ lô của một dòng: { phanBo: [{ loHangId, soLuong }] }, tổng phải bằng số cần nhặt. */
  async luuPhanBoLo(id, chiTietId, payload) {
    const res = await apiClient.put(`${BASE}/pick-list/${id}/chi-tiet/${chiTietId}/phan-bo-lo`, payload);
    return res.data?.data;
  },
  async getHangCanHoanKe(khoId) {
    const res = await apiClient.get(`${BASE}/hang-can-hoan-ke`, { params: { khoId } });
    return res.data?.data;
  },
  async xacNhanHoanKe(id) {
    const res = await apiClient.post(`${BASE}/xac-nhan-hoan-ke/${id}`);
    return res.data?.data;
  },
  /**
   * Người giao được phiếu nhặt: nhân viên kho / quản lý kho đang hoạt động, có phân quyền ở kho của phiếu (quản trị viên
   * và quản lý kho gọi được). Mỗi người: { id, hoTen, tenDangNhap, vaiTro }.
   */
  async getNguoiNhat(id) {
    const res = await apiClient.get(`${BASE}/pick-list/${id}/nguoi-nhat`);
    return res.data?.data;
  },
};

export const nhatHangService = PICKLIST_MOCK ? nhatHangMock : realService;
export const isPickListMock = PICKLIST_MOCK;
