package com.dev.backend.services.impl.utils;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/**
 * Giới hạn tần suất gửi OTP quên mật khẩu (lưu trong bộ nhớ, 1 instance backend).
 * Chống spam hộp thư nạn nhân, chống dò mã bằng cách gửi lại liên tục và giữ quota Gmail SMTP
 * (vượt quota -> Gmail khoá gửi ~24h, mọi email khác của hệ thống cũng dừng).
 * <ul>
 *   <li>Theo chuỗi người dùng nhập + theo IP: áp dụng cho MỌI yêu cầu (kể cả tài khoản không tồn tại)
 *       để phản hồi giống nhau, không lộ tài khoản nào tồn tại.</li>
 *   <li>Theo tài khoản + quota toàn hệ thống: chỉ tính khi thực sự gửi email.</li>
 * </ul>
 * Kiểm tra và ghi nhận trong MỘT lần gọi: hoặc qua hết mọi giới hạn và được ghi nhận, hoặc không ghi gì
 * (yêu cầu bị từ chối không làm người dùng phải chờ thêm).
 */
@Component
public class PasswordResetRateLimiter {

    public static final Duration COOLDOWN = Duration.ofSeconds(60);
    public static final int MAX_PER_IDENTIFIER_PER_HOUR = 5;
    public static final int MAX_PER_ACCOUNT_PER_HOUR = 5;
    public static final int MAX_PER_IP_PER_HOUR = 20;
    public static final int MAX_GLOBAL_PER_DAY = 100;

    private static final Duration HOUR = Duration.ofHours(1);
    private static final Duration DAY = Duration.ofDays(1);
    private static final String GLOBAL_KEY = "global";

    public enum Reason { COOLDOWN, TOO_MANY, GLOBAL_LIMIT }

    /** Kết quả kiểm tra: allowed = true thì đã được ghi nhận. */
    public record Decision(boolean allowed, Reason reason, long retryAfterSeconds) {
        public static final Decision ALLOWED = new Decision(true, null, 0);
    }

    // key -> các mốc thời gian (cũ -> mới); mọi truy cập đều trong synchronized nên dùng HashMap thường
    private final Map<String, Deque<Instant>> events = new HashMap<>();
    private final Clock clock;

    public PasswordResetRateLimiter() {
        this(Clock.systemUTC());
    }

    // test: truyền Clock điều khiển được để kiểm tra cooldown / cửa sổ thời gian
    public PasswordResetRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Kiểm tra + ghi nhận một yêu cầu gửi mã.
     *
     * @param identifier chuỗi người dùng nhập (đã chuẩn hoá)
     * @param clientIp   IP client
     * @param accountId  tài khoản sẽ nhận email; null nếu không gửi (không tồn tại / bị khoá / không có email)
     */
    public synchronized Decision tryAcquire(String identifier, String clientIp, Integer accountId) {
        Instant now = clock.instant();
        // hết quota toàn hệ thống: trả cùng một lỗi cho mọi người (không phụ thuộc tài khoản có tồn tại)
        long global = retryAfter(GLOBAL_KEY, now, MAX_GLOBAL_PER_DAY, DAY, null);
        if (global > 0) return new Decision(false, Reason.GLOBAL_LIMIT, global);

        String idKey = "id:" + identifier;
        String ipKey = "ip:" + clientIp;
        String accKey = accountId == null ? null : "acc:" + accountId;

        long cooldown = Math.max(
                retryAfter(idKey, now, Integer.MAX_VALUE, HOUR, COOLDOWN),
                accKey == null ? 0 : retryAfter(accKey, now, Integer.MAX_VALUE, HOUR, COOLDOWN));
        if (cooldown > 0) return new Decision(false, Reason.COOLDOWN, cooldown);

        long tooMany = Math.max(
                Math.max(retryAfter(idKey, now, MAX_PER_IDENTIFIER_PER_HOUR, HOUR, null),
                        retryAfter(ipKey, now, MAX_PER_IP_PER_HOUR, HOUR, null)),
                accKey == null ? 0 : retryAfter(accKey, now, MAX_PER_ACCOUNT_PER_HOUR, HOUR, null));
        if (tooMany > 0) return new Decision(false, Reason.TOO_MANY, tooMany);

        record(idKey, now);
        record(ipKey, now);
        if (accKey != null) {
            record(accKey, now);
            record(GLOBAL_KEY, now);
        }
        return Decision.ALLOWED;
    }

    /** Dọn các mốc đã quá cửa sổ dài nhất (gọi định kỳ từ SchedulingJob). */
    public synchronized void purgeExpired() {
        Instant now = clock.instant();
        events.entrySet().removeIf(e -> {
            Duration window = GLOBAL_KEY.equals(e.getKey()) ? DAY : HOUR;
            prune(e.getValue(), now, window);
            return e.getValue().isEmpty();
        });
    }

    synchronized int trackedKeys() {
        return events.size();
    }

    /**
     * Số giây phải chờ (0 = được phép): vượt max lần trong window, hoặc chưa đủ khoảng cách minInterval
     * kể từ lần gần nhất.
     */
    private long retryAfter(String key, Instant now, int max, Duration window, Duration minInterval) {
        Deque<Instant> q = events.get(key);
        if (q == null) return 0;
        prune(q, now, window);
        if (q.isEmpty()) return 0;
        Instant waitUntil = null;
        if (minInterval != null && q.peekLast().plus(minInterval).isAfter(now)) {
            waitUntil = q.peekLast().plus(minInterval);
        }
        if (q.size() >= max) {
            Instant windowFree = q.peekFirst().plus(window);
            if (waitUntil == null || windowFree.isAfter(waitUntil)) waitUntil = windowFree;
        }
        if (waitUntil == null) return 0;
        long millis = Duration.between(now, waitUntil).toMillis();
        return Math.max(1, (millis + 999) / 1000); // làm tròn lên, tối thiểu 1 giây
    }

    private void record(String key, Instant now) {
        events.computeIfAbsent(key, k -> new ArrayDeque<>()).addLast(now);
    }

    private static void prune(Deque<Instant> q, Instant now, Duration window) {
        Instant threshold = now.minus(window);
        while (!q.isEmpty() && !q.peekFirst().isAfter(threshold)) {
            q.pollFirst();
        }
    }
}
