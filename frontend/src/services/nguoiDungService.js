import apiClient from "./apiClient";

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

    return res.data;
},

    async updateMe(payload) {
        // payload: { hoTen, soDienThoai } — không kèm id (BE lấy user từ token)
        const res = await apiClient.put("/api/v1/nguoi-dung/me", payload);
        return res.data; // ResponseData<NguoiDungDto>
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