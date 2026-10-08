import apiClient from "@/services/apiClient";

const purchaseRequestService = {
    /**
     * Tạo yêu cầu mua hàng mới
     * POST /api/v1/nghiep-vu/yeu-cau-mua-hang/create
     */
    create: (data) => apiClient.post("/api/v1/nghiep-vu/yeu-cau-mua-hang/create", data),

    /**
     * Lấy chi tiết yêu cầu mua hàng theo id
     * GET /api/v1/yeu-cau-mua-hang/get-by-id/:id
     */
    getById: (id) => apiClient.get(`/api/v1/yeu-cau-mua-hang/get-by-id/${id}`),

    /**
     * Lọc danh sách yêu cầu mua hàng
     * POST /api/v1/yeu-cau-mua-hang/filter
     */
    filter: (payload) => apiClient.post("/api/v1/yeu-cau-mua-hang/filter", payload),

    /**
     * Duyệt hoặc từ chối yêu cầu mua hàng đang Chờ duyệt
     * PUT /api/v1/nghiep-vu/yeu-cau-mua-hang/duyet-tu-choi/:id/:trangThai
     * trangThai: 2 = duyệt, 4 = từ chối (bắt buộc lyDoTuChoi, ≤ 500 ký tự)
     */
    approve: (id, trangThai, lyDoTuChoi) =>
        apiClient.put(
            `/api/v1/nghiep-vu/yeu-cau-mua-hang/duyet-tu-choi/${id}/${trangThai}`,
            trangThai === 4 ? { lyDoTuChoi } : {}
        ),

    /**
     * Gửi yêu cầu báo giá đến nhà cung cấp (sau khi duyệt)
     * POST /api/v1/nghiep-vu/don-mua-hang/gui-yeu-cau-bao-gia
     */
    sendQuotationRequest: (data) =>
        apiClient.post("/api/v1/nghiep-vu/don-mua-hang/gui-yeu-cau-bao-gia", data),
};

export default purchaseRequestService;