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
}