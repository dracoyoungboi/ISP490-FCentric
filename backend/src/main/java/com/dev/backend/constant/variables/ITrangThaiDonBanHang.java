package com.dev.backend.constant.variables;

/**
 * Giá trị trạng thái đơn bán hàng ĐANG CHẠY trong code (0–6).
 * Được dùng bởi luồng POS mới; các service cũ vẫn dùng literal — KHÔNG đổi
 * số trạng thái nào (comment SQL cũ lệch đã được chuẩn hóa trong
 * Database/pos_checkout_v1.sql, chỉ sửa comment, không đổi dữ liệu).
 */
public interface ITrangThaiDonBanHang {
    int NHAP = 0;             // Nháp
    int CHO_XUAT_KHO = 1;     // Chờ xuất kho
    int DANG_XUAT_KHO = 2;    // Đang xuất kho (một phần) / báo giá đã chốt
    int DA_XUAT_TOAN_BO = 3;  // Đã xuất toàn bộ (đang giao)
    int DA_HUY = 4;           // Đã hủy / từ chối
    int HOAN_THANH = 5;       // Hoàn thành (đơn POS kết thúc ở đây)
    int BI_HOAN_TRA = 6;      // Bị hoàn trả
}
