import apiClient from "./apiClient";

export const phieuNhapKhoService = {
    async filter(payload) {
        const res = await apiClient.post("/api/v1/phieu-nhap-kho/filter", payload);
        return res.data;
    },
    async create(payload) {
        const res = await apiClient.post("/api/v1/phieu-nhap-kho/create", payload);
        return res.data;
    },
    async getDetail(id) {
        const res = await apiClient.get(`/api/v1/phieu-nhap-kho/${id}/detail`);
        return res.data;
    },
    /**
     * Các phiếu nhập (chưa hủy) của một đơn mua hàng, kèm chi tiết từng phiếu để dựng bảng "các đợt nhận"
     * ở màn Chi tiết đơn mua hàng. Mỗi phiếu gọi `/detail` một lần (đơn thường chỉ có vài phiếu).
     * Kết quả: chi tiết phiếu + `ngayTao` lấy từ danh sách (chi tiết không trả trường này).
     */
    async layTheoDonMua(donMuaHangId, { signal } = {}) {
        const res = await apiClient.post("/api/v1/phieu-nhap-kho/filter", {
            page: 0,
            size: 50,
            filters: [
                { fieldName: "donMuaHang.id", operation: "EQUALS", value: Number(donMuaHangId) },
                { fieldName: "trangThai", operation: "NOT_IN", value: [4] },
            ],
            sorts: [{ fieldName: "ngayTao", direction: "ASC" }],
        }, { signal });
        const danhSach = res.data?.content || [];
        return Promise.all(
            danhSach.map(async (p) => {
                const ct = await apiClient.get(`/api/v1/phieu-nhap-kho/${p.id}/detail`, { signal });
                const detail = ct.data?.data || ct.data || {};
                return { ...detail, ngayTao: p.ngayTao ?? null, trangThai: detail.trangThai ?? p.trangThai };
            }),
        );
    },
    async cancel(id) {
        return apiClient.put(`/api/v1/phieu-nhap-kho/${id}/cancel`);
    },
    async khaiBaoLo(phieuNhapKhoId, payload) {
        const res = await apiClient.post(`/api/v1/phieu-nhap-kho/${phieuNhapKhoId}/khai-bao-lo`, payload);
        return res.data;
    },
    async getLotInput(phieuNhapKhoId, bienTheSanPhamId) {
        const res = await apiClient.get(`/api/v1/phieu-nhap-kho/${phieuNhapKhoId}/bien-the/${bienTheSanPhamId}/lo-hang`);
        return res.data;
    },
    async deleteLo(phieuNhapKhoId, chiTietPhieuNhapKhoId) {
        return apiClient.delete(`/api/v1/phieu-nhap-kho/${phieuNhapKhoId}/lo-hang/${chiTietPhieuNhapKhoId}`);
    },
    async complete(id) {
        const res = await apiClient.put(`/api/v1/phieu-nhap-kho/${id}/complete`);
        return res.data;
    },
    createFromTransfer: (transferId) => {
        return apiClient.post(`/api/v1/phieu-nhap-kho/from-transfer/${transferId}`);
    },
    completeTransferReceipt: (id) => {
        return apiClient.put(`/api/v1/phieu-nhap-kho/${id}/complete-transfer`);
    },
    async createFromSalesReturn(phieuXuatId, payload = {}) {
        const res = await apiClient.post(`/api/v1/phieu-nhap-kho/from-sales-return/${phieuXuatId}`, payload);
        return res.data;
    }
};
