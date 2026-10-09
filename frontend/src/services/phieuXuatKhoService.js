import apiClient from "./apiClient";

export const phieuXuatKhoService = {
    async filter(payload) {
        const res = await apiClient.post("/api/v1/phieu-xuat-kho/filter", payload);
        return res.data?.data || res.data;
    },
    async create(payload) {
        const res = await apiClient.post("/api/v1/phieu-xuat-kho/create", payload);
        return res.data;
    },
    async getDetail(id) {
        const res = await apiClient.get(`/api/v1/phieu-xuat-kho/${id}`);
        return res.data;
    },
    // Hoàn thành/Xuất kho (0 -> 3)
    async complete(id) {
        return apiClient.put(`/api/v1/phieu-xuat-kho/${id}/complete`);
    },
    // Xác nhận xuất kho & điều phối giao vận (SRS 6.3.2)
    async xacNhanXuatKho(id, payload) {
        const res = await apiClient.post(`/api/v1/phieu-xuat-kho/${id}/xac-nhan-xuat-kho`, payload);
        return res.data;
    },
    // Hủy phiếu (-> 4)
    async cancel(id) {
        return apiClient.put(`/api/v1/phieu-xuat-kho/${id}/cancel`);
    },
    async getAvailableLots(phieuXuatKhoId, bienTheSanPhamId) {
        return apiClient.get(`/api/v1/phieu-xuat-kho/${phieuXuatKhoId}/available-lots`,
            { params: { bienTheSanPhamId } }
        ).then(res => res.data?.data || []);
    },
    async pickLo(phieuXuatKhoId, payload) {
        return apiClient.post(`/api/v1/phieu-xuat-kho/${phieuXuatKhoId}/pick-lo`, payload);
    },
    async getPickedLots(phieuXuatKhoId, chiTietPhieuXuatKhoId) {
        return apiClient.get(`/api/v1/phieu-xuat-kho/${phieuXuatKhoId}/picked-lots/${chiTietPhieuXuatKhoId}`)
            .then((res) => res.data);
    },
    async view(id) {
        const res = await apiClient.get(`/api/v1/phieu-xuat-kho/${id}/view`);
        return res.data.data;
    }
};