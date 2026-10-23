package com.dev.backend.services.email;

/** Cách mật khẩu được thay đổi, hiện trong email M4. */
public enum CachDoiMatKhau {
    /** Đặt lại ở trang Quên mật khẩu bằng mã gửi qua email. */
    DAT_LAI_BANG_MA,
    /** Đổi khi đã đăng nhập (Hồ sơ của tôi, hoặc lần đổi bắt buộc đầu tiên). */
    DOI_KHI_DA_DANG_NHAP
}
