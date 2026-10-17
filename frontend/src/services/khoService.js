import apiClient from "./apiClient";

/**
 * Yêu cầu về một kho cụ thể (popup Chi tiết kho): gửi header kho_id là chính kho đó thay cho kho làm việc,
 * để backend (inWarehouse) kiểm tra quyền đúng kho đang xem.
 */
const theoKho = (id) => ({ needKho: false, headers: { kho_id: String(id) } });

export const khoService = {
  /**
   * Số liệu tóm tắt cho popup Chi tiết kho:
   * { khoId, soLuongTon, soLuongKhaDung, soLuongDangGiu, giaTriTon, soMaHang, soMaHetHang, soMaSapHet,
   *   nguongSapHet, soNguoiPhanQuyen }. Quản lý kho chỉ xem được kho mình phụ trách (403).
   */
  tomTat: async (id) => {
    const res = await apiClient.get(`/api/v1/kho/${id}/tom-tat`, theoKho(id));
    return res.data?.data ?? null;
  },
  /** Khu vực và vị trí kệ của một kho: { khuVucs, viTris }. */
  khuVucVaViTri: async (id) => {
    const [khuVuc, viTri] = await Promise.all([
      apiClient.get(`/api/v1/kho/${id}/khu-vuc`, theoKho(id)),
      apiClient.get(`/api/v1/kho/${id}/vi-tri`, theoKho(id)),
    ]);
    return { khuVucs: khuVuc.data?.data ?? [], viTris: viTri.data?.data ?? [] };
  },
  /** Ngừng hoạt động (0) / cho phép hoạt động lại (1); trả về kho sau khi đổi. */
  doiTrangThai: async (id, trangThai) => {
    const res = await apiClient.put(`/api/v1/kho/${id}/trang-thai`, { trangThai });
    return res.data?.data ?? null;
  },
  filter: (payload) => {
    console.log(payload);
    return apiClient.post("/api/v1/kho/filter", payload);
  },
  getById: (id) =>
    apiClient.get(`/api/v1/kho/get-by-id/${id}`),
  create: (payload) => {
    return apiClient.post("/api/v1/kho/create", payload);
  },
  update: async (payload) => {
    try {
      return await apiClient.put("/api/v1/kho/update", payload);
    } catch (error) {
      // Chỉ thử POST khi máy chủ cũ không nhận PUT. Lỗi nghiệp vụ (vd. "Đã có Kho tổng đang hoạt động")
      // phải trả nguyên cho màn hình, trước đây bị lỗi của lần gọi POST đè mất.
      const status = error?.response?.status;
      if (status === 404 || status === 405) return apiClient.post("/api/v1/kho/update", payload);
      throw error;
    }
  },
  getAllKho: async () => {
    const res = await apiClient.post("/api/v1/kho/filter", {
      filters: [],
      sorts: [],
      page: 0,
      size: 1000,
    });
    return res.data;
  },
  getManagers: () => {
    return apiClient.post("/api/v1/admin/filter", {
      page: 0,
      size: 100,
      filters: [
        {
          fieldName: "vaiTro",
          operation: "EQUALS",
          value: "quan_ly_kho",
          logicType: "AND",
        },
        {
          fieldName: "trangThai",
          operation: "EQUALS",
          value: 1,
          logicType: "AND",
        },
      ],
      sorts: [{ fieldName: "hoTen", direction: "ASC" }],
    });
  },
};

// FIX: Thêm getKhoList dùng endpoint /filter với payload rỗng để lấy tất cả kho
export const getKhoList = async () => {
  const res = await apiClient.post("/api/v1/kho/filter", {
    filters: [],
    sorts: [],
    page: 0,
    size: 1000,
  });
  // Trả về mảng content từ Page object
  return res.data?.data?.content ?? [];
};
export const getMineKhoList = async () => {
  const res = await apiClient.post("/api/v1/kho/mine", {
    filters: [],
    sorts: [],
    page: 0,
    size: 1000
  });
  return res.data?.data?.content ?? [];
};
