import apiClient from './apiClient';

export const thongKeHeThongService = {

    getTonKho: () =>
        apiClient.get("/api/v1/thong-ke-he-thong/ton-kho"),

    getTonKhoBienThe: (bienTheId) =>
        apiClient.get(`/api/v1/thong-ke-he-thong/ton-kho-bien-the/${bienTheId}`),

    filterTonKho: (filterPayload) =>
        apiClient.post("/api/v1/thong-ke-he-thong/ton-kho/filter", filterPayload),

    getBienTheByProduct: (sanPhamId) =>
        apiClient.get(`/api/v1/bien-the-san-pham/by-product/${sanPhamId}`),

    /**
     * Phần đang kiểm kê theo (kho, mã hàng) — nhãn "Đang kiểm kê N" ở màn tồn (số tồn giữ nguyên). params: { khoId } hoặc
     * { bienTheId }. Trả [{ khoId, bienTheId, soLuong, maDotKiemKe, toanKho }]; kho không có đợt thì không có dòng.
     */
    getDangKiemKe: (params) =>
        apiClient.get("/api/v1/thong-ke-he-thong/dang-kiem-ke", { params }),

    getTonKhoTongQuan: (params) =>
        apiClient.get("/api/v1/thong-ke-he-thong/ton-kho-tong-quan", { params }),

    /** Tệp .xlsx (phản hồi axios, data là Blob) của Báo cáo tồn kho: khoId, keyword, tinhTrang (giá trị tab trên đường dẫn). */
    xuatExcelTonKho: (params) =>
        apiClient.get("/api/v1/thong-ke-he-thong/ton-kho-tong-quan/xuat-excel", { params, responseType: "blob" }),

};