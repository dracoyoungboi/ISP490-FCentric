package com.dev.backend.services.impl.utils;

import com.dev.backend.config.EmailTemplateConfig;
import com.dev.backend.services.email.CuaHangEmailFactory;
import com.dev.backend.services.email.DungMauEmail;
import com.dev.backend.services.email.EmailDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.thymeleaf.spring6.ISpringTemplateEngine;

import java.util.concurrent.Executor;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Spring dựng được các bean như khi chạy thật (không cần DB, không SMTP): bộ giới hạn Quên mật khẩu, bộ gửi email
 * (thay OtpMailDispatcher) với engine Thymeleaf riêng cho email; KHÔNG tạo bean Executor (tránh làm Spring Boot bỏ
 * applicationTaskExecutor mặc định) và chỉ có một ISpringTemplateEngine.
 * Tài khoản SMTP lấy từ biến môi trường (không còn MailConfig viết thẳng mật khẩu); thiếu thì KiemTraCauHinhEmail
 * ghi log ERROR lúc khởi động (KiemTraCauHinhEmailTest).
 */
@SpringJUnitConfig(classes = {PasswordResetRateLimiter.class, EmailDispatcher.class, DungMauEmail.class,
        EmailTemplateConfig.class})
class PasswordResetBeansWiringTest {

    @MockitoBean
    private JavaMailSender mailSender;
    @MockitoBean
    private CuaHangEmailFactory cuaHangEmailFactory;

    @Autowired
    private PasswordResetRateLimiter limiter;
    @Autowired
    private EmailDispatcher dispatcher;
    @Autowired
    private ApplicationContext context;

    @Test
    void cacBeanDuocTaoVaHoatDong() {
        assertTrue(limiter.tryAcquire("khang", "1.1.1.1", 7).allowed());
        assertFalse(limiter.tryAcquire("khang", "1.1.1.1", 7).allowed());
        assertNotNull(dispatcher);
        assertEquals(1, context.getBeanNamesForType(ISpringTemplateEngine.class).length);
        assertNotNull(context.getBean("emailTemplateEngine"));
    }

    @Test
    void khongDangKyBeanExecutor() {
        assertEquals(0, context.getBeanNamesForType(Executor.class).length);
    }
}
