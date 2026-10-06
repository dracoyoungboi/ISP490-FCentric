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
        return apiClient.patch(`/api/v1/san-pham-quan-ao/${id}/basic-info`, payload);
    },


    deleteProduct: (id) => {
        return apiClient.delete(`/api/v1/san-pham-quan-ao/soft-delete/${id}`);
    },

    updateStatus: (id, status) => {
        return apiClient.patch(`/api/v1/san-pham-quan-ao/status/${id}?status=${status}`);
    },

    updateSkuPrice: (skuId, giaBan, giaVon) => {
        let query = `/api/v1/san-pham-quan-ao/sku/${skuId}/price?`;
        if (giaBan !== undefined) query += `price=${giaBan}&`;
        if (giaVon !== undefined) query += `cost=${giaVon}`;
        return apiClient.patch(query);
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