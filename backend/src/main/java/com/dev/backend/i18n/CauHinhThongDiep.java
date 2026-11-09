package com.dev.backend.i18n;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Dùng chung kho câu thông báo làm bean {@code messageSource} của Spring (thay bản tự cấu hình của Spring Boot). */
@Configuration
public class CauHinhThongDiep {

    @Bean
    public MessageSource messageSource() {
        return BoThongDiep.nguon();
    }
}
