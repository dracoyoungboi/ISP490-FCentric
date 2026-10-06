import apiClient from "./apiClient";
import {
    clearCurrentUserProfile,
    setCurrentUserProfile,
} from "../utils/avatar";

export const nguoiDungService = {

    async getById(id) {
        const res = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${id}`);
        return res.data; // ResponseData<NguoiDungDto>
    },

  async getMe(config = {}) {
    // Chỉ giới hạn thời gian chờ cho request kiểm tra phiên đăng nhập.
    const res = await apiClient.get("/api/v1/nguoi-dung/me", {
        ...config,
        timeout: config.timeout ?? 15000,
    });

    // Đồng bộ cache hiển thị header (avatarUrl + họ tên) từ nguồn DB thật
    setCurrentUserProfile(res?.data?.data);

    return res.data;
},

    async updateMe(payload) {
        // payload: { hoTen, soDienThoai } — không kèm id (BE lấy user từ token)
        const res = await apiClient.put("/api/v1/nguoi-dung/me", payload);

        // DTO trả về là hồ sơ mới nhất -> đồng bộ cache hiển thị header
        setCurrentUserProfile(res?.data?.data);

        return res.data; // ResponseData<NguoiDungDto>
    },

    // Upload/đổi ảnh đại diện của người đang đăng nhập.
    // PHẢI dùng postForm (axios >= 1.4): apiClient có default Content-Type
    // application/json, nếu gọi post() thường thì transformRequest của axios
    // sẽ âm thầm chuyển FormData -> JSON (mất file) và backend báo
    // "Current request is not a multipart request". postForm ép Content-Type
    // multipart/form-data; trình duyệt tự thêm boundary.
    async uploadAvatar(file) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await apiClient.postForm("/api/v1/nguoi-dung/me/avatar", formData);

        setCurrentUserProfile(res?.data?.data);

        return res.data; // ResponseData<NguoiDungDto> (avatarUrl đã chuẩn hóa HTTPS)
    },

    // Xóa ảnh đại diện của người đang đăng nhập (về hiển thị initials)
    async removeAvatar() {
        const res = await apiClient.delete("/api/v1/nguoi-dung/me/avatar");

        setCurrentUserProfile(res?.data?.data);

        return res.data; // ResponseData<NguoiDungDto> (avatarUrl = null)
    },

    async login(payload) {
        // skipAccountDisabledHandling: lỗi khóa tài khoản khi đăng nhập được hiển thị
        // trong banner của trang Login thay vì xử lý logout toàn cục ở apiClient
        const res = await apiClient.post("/api/v1/nguoi-dung/login", payload, {
            skipAuth: true,
            skipAccountDisabledHandling: true,
        });
        const token = res?.data?.data?.token;
        const nguoiDung = res?.data?.data?.nguoiDung;
        if (token) localStorage.setItem("access_token", token);
        if (nguoiDung?.vaiTro) {
            localStorage.setItem("role", nguoiDung.vaiTro);
        }
        // Cache hồ sơ (avatarUrl + họ tên) từ login response — đúng tài khoản vừa đăng nhập,
        // ghi đè cache của tài khoản trước để không hiện nhầm ảnh
        if (nguoiDung) setCurrentUserProfile(nguoiDung);
        return res.data;
    },

    async sendForgotPasswordOTP(usernameOrEmail) {
        // BE expects: { username }
        const res = await apiClient.post(
            "/api/v1/nguoi-dung/forgot-password",
            { username: usernameOrEmail },
            { skipAuth: true }
        );
        return res.data;
    },

    async resetPassword({ username, otp, password }) {
        // BE expects: { username, otp, password }
        const res = await apiClient.post(
            "/api/v1/nguoi-dung/reset-password",
            { username, otp, password },
            { skipAuth: true }
        );
        return res.data;
    },

    logout() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("role");
        localStorage.removeItem("selected_kho_id");
        clearCurrentUserProfile();
    },

    getToken() {
        return localStorage.getItem("access_token");
    },

    async changePassword(payload) {
        // payload: { currentPassword, newPassword } — không kèm id (BE lấy user từ token)
        const res = await apiClient.post("/api/v1/nguoi-dung/change-password", payload);
        return res.data;
    },

    async updatePermission(payload) {
        // payload: { id, vaiTro }
        const res = await apiClient.put("/api/v1/dieu-hanh-he-thong/vai-tro/gan-vai-tro", payload);
        return res.data;
    },

};