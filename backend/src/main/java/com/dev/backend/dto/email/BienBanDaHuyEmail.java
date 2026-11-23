package com.dev.backend.dto.email;

/**
 * M6 · Biên bản trả hàng đã hủy (phiếu nhập bị hủy, hoặc không còn hàng lỗi).
 *
 * @param maDon   null khi phiếu nhập không thuộc đơn mua
 * @param ngayLap "23/11/2026"; null thì bỏ
 */
public record BienBanDaHuyEmail(String tenNhaCungCap, String maBienBan, String maDon, String soPhieuNhap,
                                String ngayLap) {
}
