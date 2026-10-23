package com.dev.backend.services.email;

/** Email gửi ngay (E5) không gửi được. Không chứa nội dung thư hay mã xác nhận. */
public class EmailKhongGuiDuocException extends RuntimeException {
    public EmailKhongGuiDuocException(String message, Throwable cause) {
        super(message, cause);
    }
}
