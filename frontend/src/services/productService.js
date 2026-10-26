import apiClient from "./apiClient";

export const productService = {

    filterProducts: (payload) => {
        return apiClient.post("/api/v1/san-pham-quan-ao/filter", payload);
    },


    getProductById: (id) => {
        return apiClient.get(`/api/v1/san-pham-quan-ao/get-by-id/${id}`);
    },


    createProduct: (formData) => {
        return apiClient.post("/api/v1/san-pham-quan-ao/create", formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },


    updateProduct: (id, formData) => {
        return apiClient.put("/api/v1/san-pham-quan-ao/update", formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },


    updateProductBasicInfo: (id, payload) => {
        // Khớp với BE: @PatchMapping("/basic-info/{id}") trong SanPhamQuanAoController
        return apiClient.patch(`/api/v1/san-pham-quan-ao/basic-info/${id}`, payload);
    },


    deleteProduct: (id) => {
        return apiClient.delete(`/api/v1/san-pham-quan-ao/soft-delete/${id}`);
    },

    updateStatus: (id, status) => {
        return apiClient.patch(`/api/v1/san-pham-quan-ao/status/${id}?status=${status}`);
    },

    /**
     * Màn "Giá bán & tem mã vạch": sản phẩm (phân trang theo sản phẩm) kèm biến thể khớp bộ lọc, số đếm theo tab và số
     * SKU cần xử lý giá. `size` là số SẢN PHẨM mỗi trang. Trả phần `data` của phản hồi.
     */
    locGiaBan: async ({ page = 0, size = 20, tuKhoa = "", trangThai = "tat-ca", canXuLyGia = false } = {}) => {
        const res = await apiClient.post(
            "/api/v1/san-pham-quan-ao/gia-ban/filter",
            { page, size, tuKhoa, trangThai, canXuLyGia },
            { needKho: false },
        );
        return res.data?.data;
    },

    /** Đổi giá bán (chỉ quản trị viên): `items` = [{ bienTheId, giaBan }], `lyDo` bắt buộc. Trả { daDoi, boQua }. */
    doiGiaBan: async ({ items, lyDo }) => {
        const res = await apiClient.patch("/api/v1/san-pham-quan-ao/sku/gia-ban", { items, lyDo }, { needKho: false });
        return res.data?.data;
    },

    toggleProductStatus: (id) => {
        return apiClient.post(`/api/v1/products/${id}/toggle-status`);
    },

    getCategories: () => {
        return apiClient.get("/api/v1/danh-muc-quan-ao/all");
    },

    getColors: () => {
        return apiClient.get("/api/v1/mau-sac/all");
    },


    getSizes: () => {
        return apiClient.get("/api/v1/size/all");
    },


    getMaterials: () => {
        return apiClient.get("/api/v1/chat-lieu/all");
    },


    getProductVariants: (productId) => {
        return apiClient.get(`/api/v1/san-pham-quan-ao/${productId}/variants`);
    }
};