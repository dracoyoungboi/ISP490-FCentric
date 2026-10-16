import apiClient from "./apiClient";
import { NHAP_KHO_MOCK } from "@/mocks/mockHelpers";
import { viTriKhoMock } from "@/mocks/viTriKhoMock";

/**
 * Khu vực, vị trí kệ và mặt bằng kho (FO-094).
 *
 * Máy chủ CHƯA có các API này. Khi chưa có thì service không gọi mạng: hàm đọc trả về rỗng,
 * hàm ghi báo lỗi "chưa hỗ trợ", và các màn chỉ hiện một dòng thông báo.
 * Backend làm xong thì đổi cờ dưới đây thành true (đường dẫn đã thống nhất trong kế hoạch FO-094).
 * Khi chưa có máy chủ, màn tự chạy dữ liệu mẫu (mocks/) để cả nhóm xem trên web; tắt bằng VITE_NHAP_KHO_MOCK=false.
 */
export const VI_TRI_KHO_DA_CO_MAY_CHU = false;

/** Đang chạy dữ liệu mẫu: máy chủ chưa có API (mặc định bật, tắt bằng VITE_NHAP_KHO_MOCK=false). */
export const VI_TRI_KHO_MAU = !VI_TRI_KHO_DA_CO_MAY_CHU && NHAP_KHO_MOCK;

export const THONG_BAO_CHUA_HO_TRO_VI_TRI = "Máy chủ chưa hỗ trợ khu vực và vị trí kệ.";

const data = (res) => res.data?.data;

function chuaHoTro() {
  return Promise.reject(new Error(THONG_BAO_CHUA_HO_TRO_VI_TRI));
}

const KHO = (khoId) => `/api/v1/kho/${khoId}`;

const realService = {
  hoTro: VI_TRI_KHO_DA_CO_MAY_CHU,
  mau: false,

  // ── Khu vực ──
  /** [{ id, maKhuVuc, tenKhuVuc, loaiKhu, ghiChu, soViTri }] */
  async dsKhuVuc(khoId) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU || !khoId) return [];
    return (await apiClient.get(`${KHO(khoId)}/khu-vuc`).then(data)) ?? [];
  },
  taoKhuVuc(khoId, payload) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU) return chuaHoTro();
    return apiClient.post(`${KHO(khoId)}/khu-vuc`, payload).then(data);
  },
  /** { tenKhuVuc, loaiKhu, ghiChu } — mã khu không đổi (đã dùng trên mặt bằng và chứng từ). */
  suaKhuVuc(khoId, khuVucId, payload) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU) return chuaHoTro();
    return apiClient.put(`${KHO(khoId)}/khu-vuc/${khuVucId}`, payload).then(data);
  },
  /** Chỉ xóa được khu không còn vị trí kệ (máy chủ trả 409 nếu còn); máy chủ gỡ luôn khu khỏi mặt bằng. */
  xoaKhuVuc(khoId, khuVucId) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU) return chuaHoTro();
    return apiClient.delete(`${KHO(khoId)}/khu-vuc/${khuVucId}`).then(data);
  },

  // ── Vị trí kệ ──
  /** [{ id, maViTri, khuVucId, day, hang, tang, sucChua, dangChua, trangThai: HOAT_DONG | BAO_TRI }] */
  async dsViTri(khoId) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU || !khoId) return [];
    return (await apiClient.get(`${KHO(khoId)}/vi-tri`).then(data)) ?? [];
  },
  /**
   * Một vị trí: { khuVucId, maViTri, day, hang: "01", tang: "02", sucChua, trangThai }
   * Hàng loạt: { khuVucId, day, hangTu, hangDen, tangTu, tangDen, sucChua, trangThai } — máy chủ bỏ qua mã đã có.
   * Trả về danh sách vị trí vừa tạo.
   */
  taoViTri(khoId, payload) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU) return chuaHoTro();
    return apiClient.post(`${KHO(khoId)}/vi-tri`, payload).then(data);
  },
  /** { khuVucId, sucChua, trangThai: HOAT_DONG | BAO_TRI } — dãy / hàng / tầng không đổi vì mã đã dán trên kệ. */
  suaViTri(khoId, viTriId, payload) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU) return chuaHoTro();
    return apiClient.put(`${KHO(khoId)}/vi-tri/${viTriId}`, payload).then(data);
  },
  /** Chỉ xóa được vị trí đang trống (dangChua = 0); máy chủ trả 409 nếu kệ còn hàng. */
  xoaViTri(khoId, viTriId) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU) return chuaHoTro();
    return apiClient.delete(`${KHO(khoId)}/vi-tri/${viTriId}`).then(data);
  },
  /** Lô đang nằm trên kệ: [{ maLo, tenBienThe, soLuong }] */
  async loTrenKe(khoId, viTriId) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU || !khoId) return [];
    return (await apiClient.get(`${KHO(khoId)}/vi-tri/${viTriId}/lo-hang`).then(data)) ?? [];
  },

  // ── Mặt bằng ──
  /**
   * { soCot, soHang, khuVuc: [{ khuVucId, x, y, rong, cao }], cua: [{ ten, huong: VAO | RA, x, y, rong, cao }],
   *   loiDi: [{ ten, x, y, rong, cao }], vatCoDinh: [{ ten, x, y, rong, cao }] } — đơn vị là ô lưới, đếm từ 1.
   */
  async matBang(khoId) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU || !khoId) return null;
    return (await apiClient.get(`${KHO(khoId)}/mat-bang`).then(data)) ?? null;
  },
  /**
   * Lưu cả mặt bằng (cùng cấu trúc với `matBang`). Màn vẽ sửa trên bản đang có rồi gửi lại cả bản,
   * nên một lần lưu luôn là một mặt bằng hoàn chỉnh (không có trạng thái nửa vời giữa các khu).
   */
  luuMatBang(khoId, matBang) {
    if (!VI_TRI_KHO_DA_CO_MAY_CHU) return chuaHoTro();
    return apiClient.put(`${KHO(khoId)}/mat-bang`, matBang).then(data);
  },
};

export const viTriKhoService = VI_TRI_KHO_MAU ? { hoTro: true, mau: true, ...viTriKhoMock } : realService;
