package com.dev.backend.constant.variables;

/**
 * Giá trị trạng thái phiếu xuất kho (cột phieu_xuat_kho.trang_thai).
 * Phiếu bán hàng: 0 Nháp → 6 Chờ xuất (đã đóng gói) → 3 Đã xuất; 4 Đã hủy.
 * 1 / 2 chỉ dành cho phiếu yêu cầu chuyển kho nội bộ (loai_xuat = 'khac').
 */
public interface ITrangThaiPhieuXuat {
    int NHAP = 0;       // Nháp (phiếu bán hàng: chờ đóng gói)
    int CHO_DUYET = 1;  // Chờ duyệt (yêu cầu chuyển kho)
    int DA_DUYET = 2;   // Đã duyệt (yêu cầu chuyển kho) — KHÔNG phải "đã hủy"
    int DA_XUAT = 3;    // Đã xuất kho
    int DA_HUY = 4;     // Đã hủy
    int CHO_XUAT = 6;   // Phiếu bán hàng đã đóng gói xong, chờ xác nhận xuất kho
}
