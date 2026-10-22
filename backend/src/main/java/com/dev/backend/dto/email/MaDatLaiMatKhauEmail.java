package com.dev.backend.dto.email;

/** E1 · Mã đặt lại mật khẩu. {@link #toString()} che mã. */
public record MaDatLaiMatKhauEmail(String hoTen, String tenDangNhap, String ma, String thoiDiemYeuCau,
                                   String hetHanLuc, String thoiHan) {
    @Override
    public String toString() {
        return "MaDatLaiMatKhauEmail[tenDangNhap=" + tenDangNhap + ", ma=***]";
    }
}
