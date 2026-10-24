import apiClient from "./apiClient";

/**
 * Hộp "In tem sản phẩm": cấu hình tem (khổ, in tên cửa hàng, in SKU, ngưỡng hỏi xác nhận, tên cửa hàng) và tra mã quét.
 * Mở cho quản trị viên, quản lý kho và nhân viên kho (TemSanPhamController); không cần kho đang chọn.
 */
export const temSanPhamService = {
    async cauHinh({ signal } = {}) {
        const res = await apiClient.get("/api/v1/tem-san-pham/cau-hinh", { signal, needKho: false });
        return res.data?.data;
    },

    /** SKU khớp đúng mã vạch hoặc SKU; không có thì null. */
    async traMa(ma) {
        const res = await apiClient.get("/api/v1/tem-san-pham/tra-ma", { params: { ma }, needKho: false });
        return res.data?.data ?? null;
    },
};
