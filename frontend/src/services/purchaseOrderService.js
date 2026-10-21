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
        // API chỉ cho nhân viên đã đăng nhập (quản trị, quản lý kho, mua hàng, nhân viên kho) nên phải gửi kèm token
        const response = await apiClient.post(`/api/v1/don-mua-hang/filter`, filterRequest, { needKho: false });
        return response.data;
    },

    buildFilterRequest: (filters = [], page = 0, size = 10, sorts = []) => ({
        filters,
        sorts: sorts.length > 0 ? sorts : [{ fieldName: 'ngayTao', direction: 'DESC' }],
        page,
        size,
    }),

    /**
     * Đơn mua và báo giá của một nhà cung cấp cho màn Chi tiết nhà cung cấp (trạng thái 1–5, bỏ 0 "Đã xóa"),
     * mới nhất trước. `khoIds`: chỉ lấy đơn nhập về các kho này (quản lý kho / nhân viên kho, như trang
     * Đơn mua hàng). Lấy tối đa `size` đơn; trả `{ nhaCungCapId, dons, tong }` để màn hình báo khi còn đơn chưa tải.
     */
    layTheoNhaCungCap: async (nhaCungCapId, { khoIds, size = 500 } = {}) => {
        const filters = [
            { fieldName: 'nhaCungCap.id', operation: 'EQUALS', value: Number(nhaCungCapId) },
            { fieldName: 'trangThai', operation: 'IN', value: [1, 2, 3, 4, 5] },
        ];
        if (Array.isArray(khoIds)) {
            filters.push({ fieldName: 'khoNhap.id', operation: 'IN', value: khoIds.length ? khoIds : [-1] });
        }
        const response = await apiClient.post(`/api/v1/don-mua-hang/filter`, {
            page: 0,
            size,
            filters,
            sorts: [{ fieldName: 'ngayTao', direction: 'DESC' }],
        }, { needKho: false });
        const page = response.data?.data ?? {};
        const dons = page.content ?? [];
        return { nhaCungCapId: Number(nhaCungCapId), dons, tong: page.totalElements ?? dons.length };
    },

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
     * Chốt báo giá của nhà cung cấp
     * PUT /api/v1/nghiep-vu/don-mua-hang/duyet-don/{id}/{trangThai} (DonMuaHangService.chotBaoGia)
     *
     * trangThai chỉ nhận:
     *   3  = Chấp nhận báo giá (thành đơn mua hàng, yêu cầu mua hàng chuyển sang 5)
     *   4  = Không chấp nhận báo giá (máy chủ gửi email lý do mặc định cho nhà cung cấp)
     * Giá trị khác → 400. Chỉ chốt được báo giá đang ở trạng thái 2 (chờ chốt); báo giá đã chốt / đã đổi ở nơi khác → 409.
     * Máy chủ ghi người bấm vào nguoiDuyet (người chốt).
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