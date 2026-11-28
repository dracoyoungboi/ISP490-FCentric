import apiClient from "./apiClient";

export const dashboardService = {
  getDashboard: () =>
    apiClient.get("/api/v1/admin/dashboard"),

  /**
   * Màn Tổng quan của quản trị viên.
   * Backend giữ kết quả 60 giây cho mỗi (kỳ, khoảng, kho); lamMoi = true (nút "Cập nhật") để tính lại ngay.
   * ky: hom_nay | hom_qua | 7_ngay | 30_ngay | thang_nay | thang_truoc | 12_thang | tuy_chon (kèm tuNgay, denNgay yyyy-MM-dd).
   * @param {{ ky?: string, tuNgay?: string, denNgay?: string, khoId?: number | null, lamMoi?: boolean }} params
   * @param {{ signal?: AbortSignal }} [config]
   */
  getTongQuan: ({ ky, tuNgay, denNgay, khoId, lamMoi } = {}, config = {}) =>
    apiClient.get("/api/v1/admin/dashboard/tong-quan", {
      ...config,
      params: { ky, tuNgay: tuNgay || undefined, denNgay: denNgay || undefined, khoId: khoId ?? undefined, lamMoi: lamMoi ? true : undefined },
      needKho: false,
    }),

  /**
   * Tổng quan của quản lý kho, nhân viên kho, nhân viên bán hàng (theo kho làm việc: header kho_id do apiClient gửi)
   * và nhân viên mua hàng (mọi kho). Backend giữ kết quả 60 giây; lamMoi = true (nút "Tải lại") để tính lại ngay.
   * Quá 30 giây không có trả lời thì coi là lỗi, để trang không đứng ở trạng thái đang tải.
   * @param {{ vaiTro?: string, lamMoi?: boolean }} params
   * @param {{ signal?: AbortSignal, timeout?: number }} [config]
   */
  getCuaToi: ({ vaiTro, lamMoi } = {}, config = {}) =>
    apiClient.get("/api/v1/tong-quan/cua-toi", {
      timeout: 30_000,
      ...config,
      params: { vaiTro: vaiTro || undefined, lamMoi: lamMoi ? true : undefined },
    }),

  /**
   * Tra còn hàng ở kho làm việc theo tên / mã sản phẩm / mã SKU (từ 2 ký tự, tối đa 6 sản phẩm).
   * Quá 15 giây không có trả lời thì coi là lỗi.
   * @param {string} q
   * @param {{ signal?: AbortSignal, timeout?: number }} [config]
   */
  traTon: (q, config = {}) =>
    apiClient.get("/api/v1/tong-quan/cua-toi/tra-ton", { timeout: 15_000, ...config, params: { q } }),
};
