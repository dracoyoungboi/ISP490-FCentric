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
     * Màn "Tem mã vạch": sản phẩm (phân trang theo sản phẩm) kèm biến thể khớp bộ lọc (giá bán, tồn, mã vạch) và số đếm
     * theo tab. `size` là số SẢN PHẨM mỗi trang. Trả phần `data` của phản hồi.
     */
    // kemDem = false: không đếm lại 4 tab (đổi tab / trang — số đếm chỉ phụ thuộc từ khóa)
    locGiaBan: async ({ page = 0, size = 20, tuKhoa = "", trangThai = "tat-ca", kemDem } = {}) => {
        const res = await apiClient.post(
            "/api/v1/san-pham-quan-ao/gia-ban/filter",
            { page, size, tuKhoa, trangThai, kemDem },
            { needKho: false },
        );
        return res.data?.data;
    },

    /** Số SKU đang hoạt động chưa có giá bán / bán thấp hơn giá vốn (chỉ quản trị viên). Trả { chuaCoGia, duoiGiaVon }. */
    demCanXuLyGia: async () => {
        const res = await apiClient.get("/api/v1/san-pham-quan-ao/gia-ban/can-xu-ly", { needKho: false });
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