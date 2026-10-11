package com.dev.backend.services.impl.utils;

import com.dev.backend.services.impl.utils.PasswordResetRateLimiter.Decision;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter.Reason;
import com.dev.backend.testsupport.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/** Giới hạn gửi OTP quên mật khẩu: cooldown, giới hạn theo giờ (chuỗi nhập / IP / tài khoản), quota ngày toàn hệ thống. */
class PasswordResetRateLimiterTest {

    private MutableClock clock;
    private PasswordResetRateLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-10-11T08:00:00Z"));
        limiter = new PasswordResetRateLimiter(clock);
    }

    private static void assertDenied(Decision d, Reason reason, long expectedSeconds) {
        assertFalse(d.allowed());
        assertEquals(reason, d.reason());
        assertEquals(expectedSeconds, d.retryAfterSeconds());
    }

    private Decision acquire(String identifier, String ip, Integer accountId) {
        return limiter.tryAcquire(identifier, ip, accountId);
    }

    // ===== theo chuỗi nhập =====

    @Test
    void cooldown60Giay_traSoGiayConLai() {
        assertTrue(acquire("khang", "1.1.1.1", 7).allowed());

        assertDenied(acquire("khang", "1.1.1.1", 7), Reason.COOLDOWN, 60);
        clock.advance(Duration.ofSeconds(45));
        assertDenied(acquire("khang", "1.1.1.1", 7), Reason.COOLDOWN, 15);
        clock.advance(Duration.ofMillis(14_500));
        assertDenied(acquire("khang", "1.1.1.1", 7), Reason.COOLDOWN, 1); // làm tròn lên
        clock.advance(Duration.ofMillis(500));
        assertTrue(acquire("khang", "1.1.1.1", 7).allowed());
    }

    @Test
    void yeuCauBiTuChoi_khongBiGhiNhan() {
        assertTrue(acquire("khang", "1.1.1.1", 7).allowed());
        for (int i = 0; i < 10; i++) acquire("khang", "1.1.1.1", 7); // spam trong cooldown
        clock.advance(Duration.ofSeconds(60));
        assertTrue(acquire("khang", "1.1.1.1", 7).allowed(), "yêu cầu bị từ chối không được tính thêm");
    }

    @Test
    void biChanOGioiHanTaiKhoan_khongTonLuotCuaChuoiNhapVaIp() {
        assertTrue(acquire("khang", "1.1.1.1", 7).allowed());
        clock.advance(Duration.ofSeconds(15));
        // cùng tài khoản qua chuỗi nhập khác -> bị chặn theo tài khoản
        assertDenied(acquire("khang@example.com", "1.1.1.1", 7), Reason.COOLDOWN, 45);
        clock.advance(Duration.ofSeconds(45));
        // chuỗi "khang@example.com" KHÔNG bị tính lượt ở lần bị chặn trước -> dùng được ngay khi tài khoản hết cooldown
        assertTrue(acquire("khang@example.com", "1.1.1.1", 7).allowed());
    }

    @Test
    void toiDa5LanMoiGio_theoChuoiNhap_keCaKhongTonTai() {
        for (int i = 0; i < 5; i++) {
            assertTrue(acquire("khongtontai", "1.1.1.1", null).allowed(), "lần " + (i + 1));
            clock.advance(Duration.ofSeconds(61));
        }
        long expected = 3600 - 5 * 61; // lần 1 lúc 0s -> được lại sau 3600s kể từ lần 1
        assertDenied(acquire("khongtontai", "1.1.1.1", null), Reason.TOO_MANY, expected);
        clock.advance(Duration.ofSeconds(expected));
        assertTrue(acquire("khongtontai", "1.1.1.1", null).allowed());
    }

    @Test
    void chuoiNhapKhacNhau_docLap() {
        assertTrue(acquire("khang", "1.1.1.1", 7).allowed());
        assertTrue(acquire("lan", "1.1.1.1", 8).allowed());
    }

    @Test
    void toiDa20LanMoiGio_theoIp() {
        for (int i = 0; i < PasswordResetRateLimiter.MAX_PER_IP_PER_HOUR; i++) {
            assertTrue(acquire("user" + i, "2.2.2.2", null).allowed(), "lần " + (i + 1));
        }
        assertDenied(acquire("userKhac", "2.2.2.2", null), Reason.TOO_MANY, 3600);
        assertTrue(acquire("userKhac", "3.3.3.3", null).allowed(), "IP khác không bị ảnh hưởng");
        clock.advance(Duration.ofHours(1));
        assertTrue(acquire("userKhac2", "2.2.2.2", null).allowed());
    }

    // ===== theo tài khoản =====

    @Test
    void taiKhoan_cooldown_va_5LanMoiGio_duDoiChuoiNhap() {
        String[] ids = {"khang", "khang@example.com", "0912345678", "KHANG2", "k3", "k4"};
        assertTrue(acquire(ids[0], "1.1.1.1", 7).allowed());
        assertDenied(acquire(ids[1], "1.1.1.1", 7), Reason.COOLDOWN, 60);
        assertTrue(acquire("lan", "1.1.1.1", 8).allowed(), "tài khoản khác độc lập");
        for (int i = 1; i <= 4; i++) {
            clock.advance(Duration.ofSeconds(60));
            assertTrue(acquire(ids[i], "1.1.1.1", 7).allowed());
        }
        clock.advance(Duration.ofSeconds(60));
        assertDenied(acquire(ids[5], "1.1.1.1", 7), Reason.TOO_MANY, 3600 - 5 * 60);
    }

    // ===== quota toàn hệ thống =====

    @Test
    void global_100EmailMoiNgay_chanMoiYeuCau() {
        for (int i = 0; i < PasswordResetRateLimiter.MAX_GLOBAL_PER_DAY; i++) {
            assertTrue(acquire("u" + i, "ip" + i, 1000 + i).allowed(), "email " + (i + 1));
        }
        assertDenied(acquire("khang", "9.9.9.9", 7), Reason.GLOBAL_LIMIT, 86400);
        // hết quota: kể cả tài khoản không tồn tại cũng nhận cùng lỗi
        assertDenied(acquire("bat_ky", "9.9.9.9", null), Reason.GLOBAL_LIMIT, 86400);
        clock.advance(Duration.ofDays(1));
        assertTrue(acquire("bat_ky", "9.9.9.9", null).allowed());
        assertTrue(acquire("khang", "9.9.9.9", 7).allowed());
    }

    @Test
    void khongGuiEmail_khongTinhVaoQuotaHeThong() {
        for (int i = 0; i < 300; i++) {
            acquire("u" + i, "ip" + (i / 10), null);
        }
        assertTrue(acquire("khang", "1.1.1.1", 7).allowed(), "chỉ email thực sự gửi mới tính quota");
    }

    // ===== dọn bộ nhớ =====

    @Test
    void purgeExpired_xoaKeyHetHan_giuQuotaNgay() {
        acquire("khang", "1.1.1.1", 7);
        assertEquals(4, limiter.trackedKeys()); // id, ip, acc, global
        clock.advance(Duration.ofHours(1).plusSeconds(1));
        limiter.purgeExpired();
        assertEquals(1, limiter.trackedKeys(), "chỉ còn quota ngày");
        clock.advance(Duration.ofDays(1));
        limiter.purgeExpired();
        assertEquals(0, limiter.trackedKeys());
    }

    // ===== đồng thời =====

    @Test
    void dongThoi_cungTaiKhoan_quaNhieuChuoiNhap_chiMotYeuCauDuocPhep() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(16);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger allowed = new AtomicInteger();
        try {
            var futures = new java.util.ArrayList<Future<?>>();
            for (int i = 0; i < 16; i++) {
                String identifier = "id" + (i % 3); // username / email / SĐT của cùng tài khoản
                futures.add(pool.submit(() -> {
                    start.await();
                    if (acquire(identifier, "1.1.1.1", 7).allowed()) allowed.incrementAndGet();
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> f : futures) f.get(10, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }
        assertEquals(1, allowed.get());
    }
}
