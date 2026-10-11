import apiClient from "./apiClient";

export const dashboardService = {
  getDashboard: () =>
    apiClient.get("/api/v1/admin/dashboard"),

  /**
   * Màn Tổng quan của quản trị viên.
   * Backend giữ kết quả 60 giây cho mỗi (kỳ, kho); lamMoi = true (nút "Cập nhật") để tính lại ngay.
   * @param {{ ky?: "7_ngay" | "30_ngay" | "12_thang", khoId?: number | null, lamMoi?: boolean }} params
   * @param {{ signal?: AbortSignal }} [config]
   */
  getTongQuan: ({ ky, khoId, lamMoi } = {}, config = {}) =>
    apiClient.get("/api/v1/admin/dashboard/tong-quan", {
      ...config,
      params: { ky, khoId: khoId ?? undefined, lamMoi: lamMoi ? true : undefined },
      needKho: false,
    }),
};
