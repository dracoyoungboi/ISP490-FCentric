package com.dev.backend.exception.customize;

import org.springframework.http.HttpStatus;

import java.util.Map;

// Token phát hành trước lần đổi/đặt lại mật khẩu gần nhất -> 401, FE xoá phiên và về trang đăng nhập
public class SessionRevokedException extends CommonException {

    public SessionRevokedException() {
        super("Mật khẩu tài khoản đã được thay đổi. Vui lòng đăng nhập lại.",
                HttpStatus.UNAUTHORIZED, Map.of("code", "SESSION_REVOKED"));
    }
}
