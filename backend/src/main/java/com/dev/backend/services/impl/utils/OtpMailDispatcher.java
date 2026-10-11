package com.dev.backend.services.impl.utils;

import com.dev.backend.services.EmailService;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Gửi email OTP quên mật khẩu ở luồng riêng: API trả về ngay, không phụ thuộc thời gian/lỗi SMTP
 * (không lộ tài khoản có tồn tại qua thời gian phản hồi, không trả lỗi SMTP kèm địa chỉ email về client).
 * Lỗi gửi chỉ ghi log phía server.
 * Pool tự quản lý, KHÔNG đăng ký thành bean Executor (tránh làm Spring Boot bỏ applicationTaskExecutor mặc định).
 */
@Slf4j
@Component
public class OtpMailDispatcher {

    private final EmailService emailService;
    private final Executor executor;
    private final ExecutorService ownedExecutor;

    @Autowired
    public OtpMailDispatcher(EmailService emailService) {
        this.emailService = emailService;
        AtomicInteger seq = new AtomicInteger();
        ThreadPoolExecutor pool = new ThreadPoolExecutor(1, 2, 60, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(200),
                r -> {
                    Thread t = new Thread(r, "otp-mail-" + seq.incrementAndGet());
                    t.setDaemon(true);
                    return t;
                });
        this.executor = pool;
        this.ownedExecutor = pool;
    }

    // test: truyền executor đồng bộ (Runnable::run) để kiểm tra kết quả ngay
    public OtpMailDispatcher(EmailService emailService, Executor executor) {
        this.emailService = emailService;
        this.executor = executor;
        this.ownedExecutor = null;
    }

    public void dispatch(Integer userId, String to, String subject, String templateFileName, Map<String, Object> params) {
        try {
            executor.execute(() -> {
                try {
                    emailService.sendHtmlEmailFromTemplate(to, subject, templateFileName, params);
                } catch (Exception e) {
                    log.error("[OtpMailDispatcher] Gửi email OTP thất bại, userId={}", userId, e);
                }
            });
        } catch (RejectedExecutionException e) {
            log.error("[OtpMailDispatcher] Hàng đợi gửi email OTP đầy, bỏ qua userId={}", userId, e);
        }
    }

    @PreDestroy
    void shutdown() throws InterruptedException {
        if (ownedExecutor != null) {
            ownedExecutor.shutdown();
            ownedExecutor.awaitTermination(30, TimeUnit.SECONDS);
        }
    }
}
