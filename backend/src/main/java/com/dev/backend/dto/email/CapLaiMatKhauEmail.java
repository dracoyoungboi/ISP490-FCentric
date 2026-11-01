package com.dev.backend.dto.email;

/**
 * E3 · Quản trị viên cấp lại mật khẩu: liên kết đặt mật khẩu mới dùng một lần. {@link #toString()} che liên kết.
 *
 * @param thoiDiem  lúc cấp lại, dạng "14:22 ngày 19/10/2026"
 * @param hetHanLuc hạn liên kết, cùng dạng
 */
public record CapLaiMatKhauEmail(String hoTen, String tenDangNhap, String thoiDiem, boolean dangKhoa,
                                 String duongDanDatMatKhau, String hetHanLuc) {
    @Override
    public String toString() {
        return "CapLaiMatKhauEmail[tenDangNhap=" + tenDangNhap + ", duongDanDatMatKhau=***]";
    }
}
