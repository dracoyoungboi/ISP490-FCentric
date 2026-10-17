import apiClient from "./apiClient";
import { NHAP_KHO_MOCK } from "@/mocks/mockHelpers";
import { maVachNhaCungCapMock } from "@/mocks/maVachNhaCungCapMock";
import { getAllSupplier } from "./supplierService";

/**
 * Liên kết mã vạch trên tem nhà cung cấp ↔ biến thể FCentric (FO-095, dùng khi quét nhập hàng FO-097).
 *
 * Máy chủ CHƯA có API này: service không gọi mạng, màn tra cứu chỉ hiện một dòng thông báo
 * và màn kiểm đếm không mở hộp liên kết mã lạ. Backend xong thì đổi cờ thành true.
 * Khi chưa có máy chủ, màn tự chạy dữ liệu mẫu (mocks/) để cả nhóm xem trên web; tắt bằng VITE_NHAP_KHO_MOCK=false.
 */
export const MA_VACH_NCC_DA_CO_MAY_CHU = true;

/** Đang chạy dữ liệu mẫu: máy chủ chưa có API (mặc định bật, tắt bằng VITE_NHAP_KHO_MOCK=false). */
export const MA_VACH_NCC_MAU = !MA_VACH_NCC_DA_CO_MAY_CHU && NHAP_KHO_MOCK;

export const THONG_BAO_CHUA_HO_TRO_MA_VACH = "Máy chủ chưa hỗ trợ liên kết mã vạch nhà cung cấp.";

const BASE = "/api/v1/ma-vach-nha-cung-cap";
const data = (res) => res.data?.data;

const realService = {
  hoTro: MA_VACH_NCC_DA_CO_MAY_CHU,
  mau: false,

  /** Nhà cung cấp cho ô lọc của trang tra cứu. */
  async dsNhaCungCap() {
    return (await getAllSupplier()) ?? [];
  },

  /**
   * Trang kết quả: { content: [{ id, maVach, maHangNcc, nhaCungCapId, tenNhaCungCap, bienTheSanPhamId,
   *   tenBienThe, sku, ngayLienKet, phieuNhapKhoId, soPhieuNhap }], totalElements }
   */
  async timKiem({ q, nhaCungCapId, page = 0, size = 20 } = {}) {
    if (!MA_VACH_NCC_DA_CO_MAY_CHU) return { content: [], totalElements: 0 };
    const params = { page, size };
    if (q?.trim()) params.q = q.trim();
    if (nhaCungCapId) params.nhaCungCapId = nhaCungCapId;
    return (await apiClient.get(BASE, { params }).then(data)) ?? { content: [], totalElements: 0 };
  },

  /** Tra một mã quét được: trả liên kết hoặc null. */
  async tra(maVach, nhaCungCapId) {
    if (!MA_VACH_NCC_DA_CO_MAY_CHU || !maVach) return null;
    return (await apiClient.get(`${BASE}/tra`, { params: { maVach, nhaCungCapId } }).then(data)) ?? null;
  },

  /** { maVach, maHangNcc, nhaCungCapId, bienTheSanPhamId, phieuNhapKhoId } */
  lienKet(payload) {
    if (!MA_VACH_NCC_DA_CO_MAY_CHU) return Promise.reject(new Error(THONG_BAO_CHUA_HO_TRO_MA_VACH));
    return apiClient.post(BASE, payload).then(data);
  },

  /** Gỡ một liên kết bị gắn nhầm; lần quét sau mã này lại là mã lạ. */
  huyLienKet(id) {
    if (!MA_VACH_NCC_DA_CO_MAY_CHU) return Promise.reject(new Error(THONG_BAO_CHUA_HO_TRO_MA_VACH));
    return apiClient.delete(`${BASE}/${id}`).then(data);
  },
};

export const maVachNhaCungCapService = MA_VACH_NCC_MAU ? { hoTro: true, mau: true, ...maVachNhaCungCapMock } : realService;
