package com.dev.backend.services.impl.utils;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.EmailService;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Gửi email OTP bất đồng bộ: lỗi SMTP / hàng đợi đầy không được ném ra phía API. */
class OtpMailDispatcherTest {

    private final EmailService emailService = mock(EmailService.class);

    @Test
    void dispatch_goiEmailServiceDungThamSo() {
        OtpMailDispatcher dispatcher = new OtpMailDispatcher(emailService, Runnable::run);
        Map<String, Object> params = Map.of("otp", "123456");

        dispatcher.dispatch(7, "a@x.com", "Lấy lại mật khẩu", "activation.html", params);

        verify(emailService).sendHtmlEmailFromTemplate("a@x.com", "Lấy lại mật khẩu", "activation.html", params);
    }

    @Test
    void dispatch_loiSmtp_khongNemRaNgoai() {
        doThrow(new CommonException("Error sending email from template activation.html to: a@x.com", new RuntimeException()))
                .when(emailService).sendHtmlEmailFromTemplate(anyString(), anyString(), anyString(), anyMap());
        OtpMailDispatcher dispatcher = new OtpMailDispatcher(emailService, Runnable::run);

        assertDoesNotThrow(() -> dispatcher.dispatch(7, "a@x.com", "s", "t", Map.of()));
    }

    @Test
    void dispatch_hangDoiDay_khongNemRaNgoai() {
        OtpMailDispatcher dispatcher = new OtpMailDispatcher(emailService, r -> {
            throw new RejectedExecutionException("full");
        });

        assertDoesNotThrow(() -> dispatcher.dispatch(7, "a@x.com", "s", "t", Map.of()));
        verifyNoInteractions(emailService);
    }

    @Test
    void poolThat_chayOLuongRieng_khongChanLuongGoi() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch sent = new CountDownLatch(1);
        doAnswer(inv -> {
            release.await(5, TimeUnit.SECONDS); // SMTP chậm
            sent.countDown();
            return null;
        }).when(emailService).sendHtmlEmailFromTemplate(anyString(), anyString(), anyString(), anyMap());
        OtpMailDispatcher dispatcher = new OtpMailDispatcher(emailService);

        long start = System.nanoTime();
        dispatcher.dispatch(7, "a@x.com", "s", "t", Map.of());
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertTrue(elapsedMs < 1000, "dispatch phải trả về ngay, mất " + elapsedMs + "ms");
        release.countDown();
        assertTrue(sent.await(5, TimeUnit.SECONDS), "email vẫn được gửi ở luồng nền");
        dispatcher.shutdown();
    }
}
