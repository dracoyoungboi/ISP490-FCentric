package com.dev.backend.constant.enums;

import java.time.Duration;

public enum OtpType {

    /** Mã đặt lại mật khẩu (Quên mật khẩu). NguoiDungService.RESET_OTP_TTL_SECONDS giữ cùng giá trị. */
    RESET_PASSWORD(Duration.ofMinutes(5)),
    /** Mã xác nhận báo giá của nhà cung cấp (E5 ghi "hiệu lực 5 phút"), gắn với một đơn mua. */
    SUPPLIER_MAIL_SIGN_KEY(Duration.ofMinutes(5));

    private final Duration thoiHan;

    OtpType(Duration thoiHan) {
        this.thoiHan = thoiHan;
    }

    /**
     * Thời hạn của mã loại này kể từ lúc tạo. Nguồn chung cho SchedulingJob (dọn mã), hetHanGiay trả cổng và
     * hetHanLuc của email mã xác nhận (E5).
     */
    public Duration thoiHan() {
        return thoiHan;
    }
}
