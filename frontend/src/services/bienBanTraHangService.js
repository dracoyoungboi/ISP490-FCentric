import apiClient from "./apiClient";
import { NHAP_KHO_MOCK } from "@/mocks/mockHelpers";
import { bienBanTraHangMock } from "@/mocks/bienBanTraHangMock";

/**
 * Biên bản trả hàng nhà cung cấp (FO-099) và lưu hàng lỗi khi kiểm đếm (FO-098).
 *
 * Máy chủ CHƯA có API này: service không gọi mạng. Màn chi tiết phiếu nhập hiện một dòng thông báo
 * ở bước "Xử lý hàng lỗi". Backend xong thì đổi cờ thành true.
 * Khi chưa có máy chủ, màn tự chạy dữ liệu mẫu (mocks/) để cả nhóm xem trên web; tắt bằng VITE_NHAP_KHO_MOCK=false.
 */
export const BIEN_BAN_TRA_HANG_DA_CO_MAY_CHU = true;

/** Đang chạy dữ liệu mẫu: máy chủ chưa có API (mặc định bật, tắt bằng VITE_NHAP_KHO_MOCK=false). */
export const BIEN_BAN_TRA_HANG_MAU = !BIEN_BAN_TRA_HANG_DA_CO_MAY_CHU && NHAP_KHO_MOCK;

export const THONG_BAO_CHUA_HO_TRO_BIEN_BAN =
  "Chưa lập được biên bản trả hàng vì máy chủ chưa hỗ trợ.";

const data = (res) => res.data?.data;

const realService = {
  hoTro: BIEN_BAN_TRA_HANG_DA_CO_MAY_CHU,
  mau: false,

  /** Biên bản của phiếu nhập: { id, soBienBan, phuongAn, ghiChu, ngayLap, items } hoặc null. */
  async layTheoPhieuNhap(phieuNhapKhoId) {
    if (!BIEN_BAN_TRA_HANG_DA_CO_MAY_CHU) return null;
    return (await apiClient.get(`/api/v1/phieu-nhap-kho/${phieuNhapKhoId}/bien-ban-tra-hang`).then(data)) ?? null;
  },

  /** payload: { phuongAn, ghiChu, items: [{ bienTheSanPhamId, maLo, lyDo, soLuong }] } */
  phatHanh(phieuNhapKhoId, payload) {
    if (!BIEN_BAN_TRA_HANG_DA_CO_MAY_CHU) return Promise.reject(new Error(THONG_BAO_CHUA_HO_TRO_BIEN_BAN));
    return apiClient.post(`/api/v1/phieu-nhap-kho/${phieuNhapKhoId}/bien-ban-tra-hang`, payload).then(data);
  },
};

export const bienBanTraHangService = BIEN_BAN_TRA_HANG_MAU ? { hoTro: true, mau: true, ...bienBanTraHangMock } : realService;
