import apiClient from "./apiClient";
/**
 * Backend response shape:
 * {
 *   status: number,
 *   data: T,
 *   message: string,
 *   error: any
 * }
 */

export const adminService = {
    getUserListByAdmin: (params) => {
        return apiClient.get("/api/v1/admin/user-list", {
            params,
        });
    },

    filterUsersByAdmin: (payload) => {
        return apiClient.post("/api/v1/admin/filter", payload);
    },


    async getByIdByAdmin(id) {
        const res = await apiClient.get(`/api/v1/admin/users/${id}`);
        return res.data;
    },
    createUserByAdmin(data) {
        return apiClient.post("/api/v1/admin/add-user", data);
    },
    resetUserPasswordRandomByAdmin(userId) {
        return apiClient.post(`/api/v1/admin/users/${userId}/reset-password-random`);
    },
    toggleUserStatusByAdmin(userId) {
        return apiClient.post(`/api/v1/admin/users/${userId}/toggle-status`);
    },

    /**
     * Lưu phân quyền trong một lần: vai trò, kho phụ trách (tối đa 1), hạn hiệu lực và tập quyền đầy đủ.
     * payload: { vaiTro, khoId, ngayKetThuc (ISO | null), quyenHanIds: number[] }.
     * Trả về hồ sơ người dùng sau khi lưu (cùng dạng GET /admin/users/{id}).
     */
    async luuPhanQuyen(userId, payload) {
        const res = await apiClient.put(`/api/v1/admin/users/${userId}/phan-quyen`, payload);
        return res.data?.data ?? null;
    },

    /** Lịch sử phân quyền (LichSuPhanQuyenDto[]), mới nhất trước. */
    async layLichSuPhanQuyen(userId) {
        const res = await apiClient.get(`/api/v1/admin/users/${userId}/lich-su-phan-quyen`);
        return Array.isArray(res.data?.data) ? res.data.data : [];
    },

    /**
     * Nhật ký đăng nhập của một người dùng (tab "Đăng nhập" ở Chi tiết): { tomTat, phien, lichSu }.
     * Dựng từ dữ liệu sẵn có — không có đăng xuất, không có thiết bị cho từng dòng lịch sử.
     */
    async layNhatKyDangNhap(userId) {
        const res = await apiClient.get(`/api/v1/admin/users/${userId}/nhat-ky-dang-nhap`);
        return res.data?.data ?? null;
    },

    /** Trạng thái đăng nhập của các người dùng đang hiện (biểu tượng bất thường ở danh sách): TrangThaiDangNhapDto[]. */
    async layTrangThaiDangNhap(ids) {
        const danhSach = Array.isArray(ids) ? ids.filter((x) => x != null) : [];
        if (danhSach.length === 0) return [];
        const res = await apiClient.get("/api/v1/admin/users/trang-thai-dang-nhap", {
            params: { ids: danhSach.join(",") },
        });
        return Array.isArray(res.data?.data) ? res.data.data : [];
    },

    /**
     * Màn Nhật ký đăng nhập toàn hệ thống: trang DongDangNhapHeThongDto.
     * params: { q, ketQua: all|thanh_cong|that_bai, soNgay: 1|7|30|90, page, size }.
     */
    async layNhatKyDangNhapHeThong(params) {
        const res = await apiClient.get("/api/v1/admin/nhat-ky-dang-nhap", { params });
        return res.data?.data ?? { content: [], totalElements: 0 };
    },

    /** Khung "Cần chú ý" của màn Nhật ký đăng nhập: CanChuYDangNhapDto[]. */
    async layCanChuYDangNhap() {
        const res = await apiClient.get("/api/v1/admin/nhat-ky-dang-nhap/can-chu-y");
        return Array.isArray(res.data?.data) ? res.data.data : [];
    },
}