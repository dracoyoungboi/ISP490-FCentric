package com.dev.backend.services.impl.utils;

import com.dev.backend.config.MailConfig;
import com.dev.backend.services.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.Map;
import java.util.concurrent.Executor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

/**
 * Spring dựng được các bean mới như khi chạy thật (không cần DB): constructor mặc định của bộ giới hạn /
 * dispatcher, MailConfig có sẵn tài khoản gửi mail, và KHÔNG tạo bean Executor
 * (tránh làm Spring Boot bỏ applicationTaskExecutor mặc định).
 */
@SpringJUnitConfig(classes = {PasswordResetRateLimiter.class, OtpMailDispatcher.class, MailConfig.class})
class PasswordResetBeansWiringTest {

    @MockitoBean
    private EmailService emailService;

    @Autowired
    private PasswordResetRateLimiter limiter;
    @Autowired
    private OtpMailDispatcher dispatcher;
    @Autowired
    private JavaMailSender mailSender;
    @Autowired
    private org.springframework.context.ApplicationContext context;

    @Test
    void cacBeanDuocTaoVaHoatDong() {
        assertTrue(limiter.tryAcquire("khang", "1.1.1.1", 7).allowed());
        assertFalse(limiter.tryAcquire("khang", "1.1.1.1", 7).allowed());

        dispatcher.dispatch(7, "a@x.com", "s", "activation.html", Map.of());
        verify(emailService, timeout(5000)).sendHtmlEmailFromTemplate("a@x.com", "s", "activation.html", Map.of());
    }

    @Test
    void mailConfig_coTaiKhoanGuiMail_khongCanBienMoiTruong() {
        // bài học vòng trước: tài khoản gửi mail rỗng -> MỌI email của hệ thống lỗi mà giao diện vẫn báo "đã gửi"
        JavaMailSenderImpl impl = (JavaMailSenderImpl) mailSender;
        assertEquals("smtp.gmail.com", impl.getHost());
        assertNotNull(impl.getUsername());
        assertFalse(impl.getUsername().isBlank(), "thiếu tài khoản gửi mail");
        assertNotNull(impl.getPassword());
        assertFalse(impl.getPassword().isBlank(), "thiếu mật khẩu gửi mail");
    }

    @Test
    void khongDangKyBeanExecutor() {
        assertEquals(0, context.getBeanNamesForType(Executor.class).length);
    }
}
