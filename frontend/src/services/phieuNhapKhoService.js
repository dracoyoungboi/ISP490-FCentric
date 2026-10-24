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
     * Số tem theo phiếu đã hoàn tất: số lượng thực nhận của từng biến thể, kèm thông tin in tem
     * (tên, màu, kích cỡ, mã vạch, giá, tồn). Phiếu chưa hoàn tất: máy chủ báo lỗi.
     */
    async soLuongInTem(id) {
        const res = await apiClient.get(`/api/v1/phieu-nhap-kho/${id}/so-luong-in-tem`);
        return res.data?.data ?? [];
    },
    /** Phiếu nhập đã hoàn tất mới nhất (hộp "In tem theo phiếu nhập"): mã, ngày, kho, nhà cung cấp, số SKU, số sản phẩm. */
    async phieuDaHoanTatInTem({ size = 20, signal } = {}) {
        const res = await apiClient.get("/api/v1/phieu-nhap-kho/in-tem/da-hoan-tat", { params: { size }, signal });
        return res.data?.data ?? [];
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
    /**
     * Phiếu nhập (chưa hủy) của một nhà cung cấp cho màn Chi tiết nhà cung cấp, mới nhất trước.
     * `khoIds`: chỉ lấy phiếu của các kho này (quản lý kho / nhân viên kho). Trả `{ nhaCungCapId, phieus, tong }`.
     */
    async layTheoNhaCungCap(nhaCungCapId, { khoIds, size = 500 } = {}) {
        const filters = [
            { fieldName: "nhaCungCap.id", operation: "EQUALS", value: Number(nhaCungCapId) },
            { fieldName: "trangThai", operation: "NOT_IN", value: [4] },
        ];
        if (Array.isArray(khoIds)) {
            filters.push({ fieldName: "kho.id", operation: "IN", value: khoIds.length ? khoIds : [-1] });
        }
        const res = await apiClient.post("/api/v1/phieu-nhap-kho/filter", {
            page: 0,
            size,
            filters,
            sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
        });
        const phieus = res.data?.content || [];
        return { nhaCungCapId: Number(nhaCungCapId), phieus, tong: res.data?.totalElements ?? phieus.length };
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
    async hoanTatKiemDemBienThe(phieuNhapKhoId, bienTheSanPhamId) {
        const res = await apiClient.put(`/api/v1/phieu-nhap-kho/${phieuNhapKhoId}/bien-the/${bienTheSanPhamId}/hoan-tat`);
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
