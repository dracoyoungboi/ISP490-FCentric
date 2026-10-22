package com.dev.backend.dto.email;

/** E3 · Quản trị viên cấp lại mật khẩu. {@link #toString()} che mật khẩu. */
public record CapLaiMatKhauEmail(String hoTen, String tenDangNhap, String matKhauTam, String thoiDiem,
                                 boolean dangKhoa, String duongDanDangNhap, String nhanDuongDan) {
    @Override
    public String toString() {
        return "CapLaiMatKhauEmail[tenDangNhap=" + tenDangNhap + ", matKhauTam=***]";
    }
}
