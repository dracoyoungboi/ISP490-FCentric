import apiClient from "./apiClient";
import { CHANNEL_MOCK } from "@/mocks/mockHelpers";
import { kenhBanHangMock } from "@/mocks/kenhBanHangMock";

const BASE = "/api/v1/kenh-ban-hang";
const data = (res) => res.data?.data;

/**
 * Cấu hình kênh Shopify — ĐÃ CÓ backend (KenhBanHangController, chỉ quan_tri_vien).
 * Token luôn trả về dạng che (accessTokenMasked, refreshTokenMasked).
 */
const shopifyApi = {
  getShopifyConfig: () => apiClient.get(`${BASE}/shopify`).then(data),
  updateShopifyConfig: (payload) => apiClient.put(`${BASE}/shopify`, payload).then(data),
  testShopifyConnection: (payload) => apiClient.post(`${BASE}/shopify/test-connection`, payload).then(data),
  refreshShopifyToken: () => apiClient.post(`${BASE}/shopify/refresh-token`).then(data),
};

const shopifyMock = {
  getShopifyConfig: kenhBanHangMock.getShopifyConfig,
  updateShopifyConfig: kenhBanHangMock.updateShopifyConfig,
  testShopifyConnection: kenhBanHangMock.testShopifyConnection,
  refreshShopifyToken: kenhBanHangMock.refreshShopifyToken,
};

/**
 * Thiết lập đồng bộ (kho, quy tắc tồn, nhận đơn), liên kết SKU, đẩy tồn, nhật ký đồng bộ:
 * backend CHƯA có API (docs/omnichannel/API-KENH-BAN-HANG.md mục 2) nên luôn chạy bằng dữ liệu mẫu.
 * Khi backend xong, thay từng hàm bằng lời gọi apiClient cùng chữ ký (Gói E).
 */
const syncPending = {
  getKetNoi: kenhBanHangMock.getKetNoi,
  getKhoSan: kenhBanHangMock.getKhoSan,
  luuCauHinh: kenhBanHangMock.luuCauHinh,
  batTatDongBo: kenhBanHangMock.batTatDongBo,
  taiSanPham: kenhBanHangMock.taiSanPham,
  tuDongLienKet: kenhBanHangMock.tuDongLienKet,
  filterLienKet: kenhBanHangMock.filterLienKet,
  capNhatLienKet: kenhBanHangMock.capNhatLienKet,
  dayTon: kenhBanHangMock.dayTon,
  layDon: kenhBanHangMock.layDon,
  dongBoTatCa: kenhBanHangMock.dongBoTatCa,
  tongQuan: kenhBanHangMock.tongQuan,
  filterNhatKy: kenhBanHangMock.filterNhatKy,
  getNhatKy: kenhBanHangMock.getNhatKy,
  thuLai: kenhBanHangMock.thuLai,
  timBienThe: kenhBanHangMock.timBienThe,
  getKhoOptions: kenhBanHangMock.getKhoOptions,
  getKhachHangOptions: kenhBanHangMock.getKhachHangOptions,
};

export const kenhBanHangService = {
  ...(CHANNEL_MOCK ? shopifyMock : shopifyApi),
  ...syncPending,
};

/** Cấu hình Shopify chạy dữ liệu mẫu khi bật VITE_CHANNEL_MOCK=true. */
export const isShopifyConfigMock = CHANNEL_MOCK;
/** Các màn Thiết lập đồng bộ / Liên kết sản phẩm / Dashboard đồng bộ: luôn là dữ liệu mẫu cho tới khi có backend. */
export const isChannelSyncMock = true;
