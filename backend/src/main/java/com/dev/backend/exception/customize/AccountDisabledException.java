package com.dev.backend.exception.customize;

import com.dev.backend.i18n.ThongDiep;
import org.springframework.http.HttpStatus;

public class AccountDisabledException extends CommonException {

    public AccountDisabledException() {
        // Câu tiếng Việt phải giữ chữ "bị khóa": giao diện dựa vào đó để nhận ra tài khoản bị khóa
        super(HttpStatus.FORBIDDEN, ThongDiep.of("heThong.taiKhoanBiKhoa"));
    }
}
