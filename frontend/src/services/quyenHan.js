import apiClient from "./apiClient";

export const quyenHanService = {

    getAllQuyenHan: () => {
        return apiClient.get("/api/v1/dieu-hanh-he-thong/quyen-han/all");
    },

    // Gán quyền cho 1 kho cụ thể (mỗi kho 1 request)
    ganQuyenQuyenHan: ({ khoId, payload }) => {
        return apiClient.post(
            "/api/v1/dieu-hanh-he-thong/quyen-han/gan-quyen",
            payload,
            {
                headers: {
                    "kho_id": khoId,
                },
            }
        );
    },

    xoaQuyenKho:(id)=>{
        return apiClient.delete(`/api/v1/dieu-hanh-he-thong/quyen-han/xoa-quyen/${id}`);
    },

    /** Danh sách quyền (QuyenHanDto[]): id, maQuyen, tenQuyen, moTa, nhomQuyen. */
    layDanhSach: async () => {
        const res = await apiClient.get("/api/v1/dieu-hanh-he-thong/quyen-han/all");
        return Array.isArray(res.data?.data) ? res.data.data : [];
    },

    /**
     * Cấu hình phân quyền (chỉ quản trị viên):
     * { mauQuyen: { [vaiTro]: id[] }, quyenNhayCam: id[], quyenDaApDung: maQuyen[] | null } — null khi máy chủ
     * không quét được quyền đang kiểm.
     */
    layCauHinhPhanQuyen: async () => {
        const res = await apiClient.get("/api/v1/dieu-hanh-he-thong/phan-quyen/cau-hinh");
        return res.data?.data ?? null;
    },

};