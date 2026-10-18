package com.dev.backend.exception.customize;

import org.springframework.http.HttpStatus;

import java.util.Map;

// Token không còn hợp lệ (đổi/đặt lại mật khẩu, quyền vừa bị thu hồi) -> 401, FE xoá phiên và về trang đăng nhập
public class SessionRevokedException extends CommonException {

    public SessionRevokedException() {
        super("Mật khẩu tài khoản đã được thay đổi. Vui lòng đăng nhập lại.",
                HttpStatus.UNAUTHORIZED, Map.of("code", "SESSION_REVOKED"));
    }

    // Cùng mã SESSION_REVOKED (FE hiện lời nhắn này ở trang đăng nhập), khác lý do: vd. quyền vừa bị đổi
    public SessionRevokedException(String message) {
        super(message, HttpStatus.UNAUTHORIZED, Map.of("code", "SESSION_REVOKED"));
    }
}
