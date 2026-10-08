import apiClient from './apiClient';

// ─── Yêu Cầu Mua Hàng (YeuCauMuaHang) ───────────────────────────────────────

export const purchaseRequestService = {
    /**
     * Lấy chi tiết yêu cầu mua hàng theo ID
     * GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}
     */
    getById: async (id) => {
        const response = await apiClient.get(`/api/v1/yeu-cau-mua-hang/get-by-id/${id}`);
        return response.data;
    },

    /**
     * Lọc và phân trang danh sách yêu cầu mua hàng
     * POST /api/v1/yeu-cau-mua-hang/filter
     */
    filter: async (filterRequest) => {
        const response = await apiClient.post(`/api/v1/yeu-cau-mua-hang/filter`, filterRequest);
        return response.data;
    },

    buildFilterRequest: (filters = [], page = 0, size = 10, sorts = []) => ({
        filters,
        sorts: sorts.length > 0 ? sorts : [{ fieldName: 'ngayTao', direction: 'DESC' }],
        page,
        size,
    }),

    /**
     * Tạo yêu cầu mua hàng mới (nhân viên kho/bán hàng/mua hàng)
     * POST /api/v1/nghiep-vu/yeu-cau-mua-hang/create
     */
    create: async (creating) => {
        const response = await apiClient.post(`/api/v1/nghiep-vu/yeu-cau-mua-hang/create`, creating);
        return response.data;
    },

    // Duyệt / từ chối yêu cầu: dùng purchaseRequestService.approve trong
    // services/purchaseRequestService.js (từ chối = trạng thái 4 + lý do).
    // Helper cũ ở đây gửi trạng thái 0 khi từ chối — sai nghiệp vụ, đã bỏ.
};

// ─── Đơn Mua Hàng (DonMuaHang) ───────────────────────────────────────────────

const purchaseOrderService = {
    /**
     * Lấy chi tiết đơn mua hàng theo ID
     * GET /api/v1/don-mua-hang/get-by-id/{id}
     */
    getById: async (id) => {
        const response = await apiClient.get(`/api/v1/don-mua-hang/get-by-id/${id}`);
        return response.data;
    },

    /**
     * Lọc và phân trang danh sách đơn mua hàng
     * POST /api/v1/don-mua-hang/filter
     */
    filter: async (filterRequest) => {
        const response = await apiClient.post(`/api/v1/don-mua-hang/filter`, filterRequest, { needToken: false, needKho: false });
        return response.data;
    },

    buildFilterRequest: (filters = [], page = 0, size = 10, sorts = []) => ({
        filters,
        sorts: sorts.length > 0 ? sorts : [{ fieldName: 'ngayTao', direction: 'DESC' }],
        page,
        size,
    }),

    /** Lấy danh sách nhà cung cấp unique từ các đơn mua hàng */
    getUniqueSuppliers: async () => {
        const response = await apiClient.post(`/api/v1/don-mua-hang/filter`, {
            filters: [],
            sorts: [{ fieldName: 'ngayTao', direction: 'DESC' }],
            page: 0,
            size: 1000,
        });
        const orders = response.data?.data?.content || [];
        const map = new Map();
        orders.forEach(o => { if (o.nhaCungCap?.id) map.set(o.nhaCungCap.id, o.nhaCungCap); });
        return Array.from(map.values()).sort((a, b) =>
            (a.tenNhaCungCap || '').localeCompare(b.tenNhaCungCap || '')
        );
    },

    /** Lấy danh sách kho unique từ các đơn mua hàng */
    getUniqueWarehouses: async () => {
        const response = await apiClient.post(`/api/v1/don-mua-hang/filter`, {
            filters: [],
            sorts: [{ fieldName: 'ngayTao', direction: 'DESC' }],
            page: 0,
            size: 1000,
        });
        const orders = response.data?.data?.content || [];
        const map = new Map();
        orders.forEach(o => { if (o.khoNhap?.id) map.set(o.khoNhap.id, o.khoNhap); });
        return Array.from(map.values()).sort((a, b) =>
            (a.tenKho || '').localeCompare(b.tenKho || '')
        );
    },

    /**
     * Nhân viên mua hàng gửi yêu cầu báo giá đến nhà cung cấp
     * POST /api/v1/nghiep-vu/don-mua-hang/gui-yeu-cau-bao-gia
     *
     * @param {Object} yeuCau - YeuCauDenNhaCungCapCreating
     */
    guiYeuCauBaoGia: async (yeuCau) => {
        const response = await apiClient.post(
            `/api/v1/nghiep-vu/don-mua-hang/gui-yeu-cau-bao-gia`,
            yeuCau
        );
        return response.data;
    },

    /**
     * Cập nhật trạng thái đơn mua hàng
     * PUT /api/v1/nghiep-vu/don-mua-hang/duyet-don/{id}/{trangThai}
     *
     * trangThai theo DonMuaHang.java:
     *   0  = Đã xóa / hủy
     *   1  = Đã gửi yêu cầu báo giá đến NCC
     *   2  = Nhà cung cấp đã báo giá
     *   3  = Chấp nhận báo giá — chờ vận chuyển
     *   4  = Không chấp nhận báo giá
     *   5  = Đã thanh toán
     */
    duyetDon: async (id, trangThai) => {
        const response = await apiClient.put(
            `/api/v1/nghiep-vu/don-mua-hang/duyet-don/${id}/${trangThai}`
        );
        return response.data;
    },

    /** Chấp nhận báo giá → trạng thái 3 */
    chapNhanBaoGia: async (id) => purchaseOrderService.duyetDon(id, 3),

    /** Từ chối báo giá → trạng thái 4 */
    tuChoiBaoGia: async (id) => purchaseOrderService.duyetDon(id, 4),

    /** Hủy đơn mua hàng → trạng thái 0 */
    huyDon: async (id) => purchaseOrderService.duyetDon(id, 0),

    /**
     * Lấy thông tin giao dịch thanh toán
     * GET /api/v1/nghiep-vu/don-mua-hang/thanh-toan/{id}
     */
    layGiaoDich: async (id) => {
        const response = await apiClient.get(`/api/v1/nghiep-vu/don-mua-hang/thanh-toan/${id}`);
        return response.data.data;
    },

    /**
     * Kiểm tra trạng thái thanh toán của đơn mua hàng
     * GET /api/v1/nghiep-vu/don-mua-hang/kiem-tra-thanh-toan/id
     */
    kiemTraThanhToan: async (id) => {
        const response = await apiClient.get(`/api/v1/nghiep-vu/don-mua-hang/kiem-tra-thanh-toan/${id}`);
        return response.data?.status === 200;
    },
};

export default purchaseOrderService;