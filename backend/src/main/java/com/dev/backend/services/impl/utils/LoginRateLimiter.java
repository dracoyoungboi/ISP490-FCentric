package com.dev.backend.services.impl.utils;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Base64;
import java.util.Deque;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Giới hạn nhập sai mật khẩu (lưu trong bộ nhớ, 1 instance backend): chống dò mật khẩu và dùng danh sách mật khẩu lộ.
 * Dùng chung cho đăng nhập và đổi mật khẩu (cùng một mật khẩu bị dò).
 * <ul>
 *   <li>Đếm theo TÀI KHOẢN khi chuỗi nhập ứng với một tài khoản: tên đăng nhập, email, SĐT và mọi biến thể hoa
 *       thường / dấu mà CSDL coi là cùng một tài khoản (collation utf8mb4_unicode_ci) dùng chung một bộ đếm. Chuỗi
 *       không ứng với tài khoản nào thì đếm theo chính chuỗi đó (chuẩn hoá bỏ dấu, hoa thường giống collation), để
 *       phản hồi giống hệt tài khoản thật, không dò được tài khoản có tồn tại.</li>
 *   <li>Hai bộ đếm cho mỗi lần thử: theo cặp (tài khoản, IP) khoá sau {@link #MAX_FAILS} lần sai, và theo riêng tài
 *       khoản khoá sau {@link #MAX_FAILS_TAI_KHOAN} lần (gộp mọi IP). Một người biết tên đăng nhập, thử từ một IP, chỉ
 *       khoá được chính mình (cặp của họ), không khoá được chủ tài khoản đang đăng nhập từ IP khác; dò từ nhiều IP thì
 *       vẫn bị chặn ở ngưỡng tài khoản. Không biết IP (đổi mật khẩu khi đã đăng nhập) thì đếm vào một cặp riêng
 *       "không IP" ngưỡng {@link #MAX_FAILS}, cặp này được xét ở mọi lần thử: người giữ phiên dò mật khẩu hiện tại thì
 *       khoá cả đăng nhập, còn đăng nhập sai không cộng vào cặp này.</li>
 *   <li>Mỗi bộ đếm: đủ ngưỡng trong {@link #WINDOW} thì khoá tạm; bị khoá lại thì thời gian khoá tăng dần theo
 *       {@link #LOCK_STEPS}; yên {@link #RESET_AFTER} không thử lần nào thì về bậc đầu.</li>
 *   <li>Lần thử được ghi nhận TRƯỚC khi kiểm mật khẩu, trong cùng một lần gọi với bước kiểm khoá
 *       ({@link #tryAcquire}): nhiều request song song không vượt được ngưỡng. Đúng mật khẩu (hoặc đặt lại mật khẩu)
 *       thì {@link #recordSuccess} xoá bộ đếm. Đang khoá thì từ chối mà không ghi nhận (không kéo dài khoá).</li>
 *   <li>Theo IP: chỉ ghi cảnh báo khi một IP sai {@link #CANH_BAO_IP} lần trong {@link #WINDOW}, KHÔNG khoá. Sau
 *       Cloudflare, IP nhận được có thể là IP edge dùng chung; khoá theo IP sẽ khoá nhầm mọi người dùng chung edge.</li>
 * </ul>
 * Bộ đếm theo chuỗi lưu bản băm cố định độ dài và có trần {@link #MAX_IDENTIFIER_KEYS}: gửi hàng loạt chuỗi ngẫu nhiên
 * không làm phình bộ nhớ (đầy trần thì chuỗi mới không được đếm — chuỗi này vốn không ứng với mật khẩu thật nào).
 */
@Slf4j
@Component
public class LoginRateLimiter {

    public static final Duration WINDOW = Duration.ofMinutes(15);
    /** Ngưỡng theo cặp (tài khoản, IP). */
    public static final int MAX_FAILS = 5;
    /** Ngưỡng theo riêng tài khoản, gộp mọi IP. */
    public static final int MAX_FAILS_TAI_KHOAN = 20;
    public static final int CANH_BAO_IP = 50;
    /** Thời gian khoá theo số lần đã bị khoá: 1, 5, 15, 30 phút, sau đó giữ mức cuối. */
    public static final Duration[] LOCK_STEPS = {
            Duration.ofMinutes(1), Duration.ofMinutes(5), Duration.ofMinutes(15), Duration.ofMinutes(30)};
    public static final Duration RESET_AFTER = Duration.ofHours(24);
    public static final int MAX_IDENTIFIER_KEYS = 100_000;
    /** Trần số bộ đếm theo cặp (tài khoản, IP); đầy trần thì cặp mới không được đếm, ngưỡng tài khoản vẫn chặn. */
    public static final int MAX_PAIR_KEYS = 100_000;
    /** "IP" của các lần thử không có IP (đổi mật khẩu khi đã đăng nhập). */
    private static final String KHONG_IP = "";

    /** Kết quả kiểm tra: allowed = false thì retryAfterSeconds là số giây còn phải chờ. */
    public record Decision(boolean allowed, long retryAfterSeconds) {
        public static final Decision ALLOWED = new Decision(true, 0);
    }

    private static final class Bucket {
        final Deque<Instant> attempts = new ArrayDeque<>();
        Instant lockedUntil;
        Instant lastAttempt;
        int lockCount;
    }

    // mọi truy cập đều trong synchronized nên dùng HashMap thường
    private final Map<Integer, Bucket> accountBuckets = new HashMap<>();
    private final Map<String, Bucket> identifierBuckets = new HashMap<>();
    // khoá chủ thể ("a:<id tài khoản>" / "i:<băm chuỗi>") → IP → bộ đếm của cặp
    private final Map<String, Map<String, Bucket>> pairBuckets = new HashMap<>();
    private int soCap;
    private final Map<String, Deque<Instant>> ipFails = new HashMap<>();
    private final Clock clock;
    private final int maxIdentifierKeys;

    public LoginRateLimiter() {
        this(Clock.systemUTC());
    }

    // test: truyền Clock điều khiển được để kiểm tra cửa sổ thời gian và thời gian khoá
    public LoginRateLimiter(Clock clock) {
        this(clock, MAX_IDENTIFIER_KEYS);
    }

    // test: trần số bộ đếm theo chuỗi nhỏ để kiểm hành vi khi đầy
    LoginRateLimiter(Clock clock, int maxIdentifierKeys) {
        this.clock = clock;
        this.maxIdentifierKeys = maxIdentifierKeys;
    }

    /**
     * Kiểm khoá và ghi nhận một lần thử (chưa biết đúng sai) trong cùng một lần gọi. Gọi TRƯỚC khi kiểm mật khẩu;
     * đúng mật khẩu thì gọi {@link #recordSuccess}.
     *
     * @param identifier chuỗi người dùng nhập (dùng khi không ứng với tài khoản nào)
     * @param accountId  tài khoản ứng với chuỗi nhập; null nếu không có
     */
    public Decision tryAcquire(String identifier, Integer accountId) {
        return tryAcquire(identifier, accountId, null);
    }

    /**
     * Như {@link #tryAcquire(String, Integer)}, kèm IP của client: bộ đếm theo cặp (tài khoản, IP) khoá sau
     * {@link #MAX_FAILS} lần, bộ đếm theo tài khoản khoá sau {@link #MAX_FAILS_TAI_KHOAN} lần. Bị khoá ở bộ nào thì từ
     * chối (chờ lâu nhất trong hai), không ghi nhận vào bộ nào.
     *
     * @param clientIp IP thật của client; null hoặc rỗng thì đếm vào cặp "không IP", ngưỡng {@link #MAX_FAILS}
     */
    public synchronized Decision tryAcquire(String identifier, Integer accountId, String clientIp) {
        String khoaChuThe = khoaChuThe(identifier, accountId);
        if (khoaChuThe == null) return Decision.ALLOWED;
        Bucket chuThe = bucketFor(khoaChuThe, accountId);
        if (chuThe == null) return Decision.ALLOWED;
        boolean coIp = clientIp != null && !clientIp.isBlank();
        // Không có IP (đổi mật khẩu khi đã đăng nhập) là một "cặp" riêng, ngưỡng MAX_FAILS. Mọi lần thử đều xét cả cặp
        // này: người giữ phiên dò mật khẩu hiện tại thì khoá cả đăng nhập; còn lần đăng nhập sai không cộng vào cặp này
        // (người ngoài không "gài" được để một lần gõ sai ở Đổi mật khẩu khoá luôn chủ tài khoản)
        Bucket cap = bucketCap(khoaChuThe, coIp ? clientIp.trim() : KHONG_IP);
        Bucket capKhongIp = coIp ? capDaCo(khoaChuThe, KHONG_IP) : null;
        Instant now = clock.instant();
        long wait = Math.max(remaining(chuThe, now), Math.max(
                cap == null ? 0 : remaining(cap, now), capKhongIp == null ? 0 : remaining(capKhongIp, now)));
        if (wait > 0) return new Decision(false, wait);

        ghiNhan(chuThe, now, MAX_FAILS_TAI_KHOAN);
        if (cap != null) ghiNhan(cap, now, MAX_FAILS);
        return Decision.ALLOWED;
    }

    private static void ghiNhan(Bucket b, Instant now, int nguong) {
        if (b.lastAttempt != null && !now.isBefore(b.lastAttempt.plus(RESET_AFTER))) {
            b.lockCount = 0;
        }
        b.lastAttempt = now;
        prune(b.attempts, now);
        b.attempts.addLast(now);
        if (b.attempts.size() >= nguong) {
            b.lockedUntil = now.plus(LOCK_STEPS[Math.min(b.lockCount, LOCK_STEPS.length - 1)]);
            b.lockCount++;
            b.attempts.clear();
        }
    }

    /**
     * Đúng mật khẩu, hoặc mật khẩu vừa được đặt lại: xoá bộ đếm và mức khoá (kể cả lần thử vừa ghi nhận ở
     * {@link #tryAcquire}).
     */
    public synchronized void recordSuccess(String identifier, Integer accountId) {
        String khoaChuThe = khoaChuThe(identifier, accountId);
        if (khoaChuThe == null) return;
        if (accountId != null) {
            accountBuckets.remove(accountId);
        } else {
            identifierBuckets.remove(khoaChuThe.substring(2));
        }
        // xoá bộ đếm của mọi cặp (tài khoản, IP)
        Map<String, Bucket> theoIp = pairBuckets.remove(khoaChuThe);
        if (theoIp != null) soCap -= theoIp.size();
    }

    /** Một lần sai đã xác định: chỉ để cảnh báo một IP dò nhiều tài khoản, không khoá. */
    public synchronized void recordFailureFromIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) return;
        Instant now = clock.instant();
        String ip = clientIp.trim();
        Deque<Instant> q = ipFails.computeIfAbsent(ip, k -> new ArrayDeque<>());
        prune(q, now);
        q.addLast(now);
        if (q.size() >= CANH_BAO_IP) {
            log.warn("[login] IP {} nhập sai mật khẩu {} lần trong {} phút, có thể đang dò mật khẩu", ip, q.size(),
                    WINDOW.toMinutes());
            q.clear(); // cảnh báo lại sau CANH_BAO_IP lần sai tiếp theo
        }
    }

    /** Dọn bộ đếm đã hết hạn (gọi định kỳ từ SchedulingJob). Giữ lại mức khoá trong {@link #RESET_AFTER}. */
    public synchronized void purgeExpired() {
        Instant now = clock.instant();
        accountBuckets.values().removeIf(b -> hetHan(b, now));
        identifierBuckets.values().removeIf(b -> hetHan(b, now));
        pairBuckets.values().removeIf(theoIp -> {
            int truoc = theoIp.size();
            theoIp.values().removeIf(b -> hetHan(b, now));
            soCap -= truoc - theoIp.size();
            return theoIp.isEmpty();
        });
        ipFails.values().removeIf(q -> {
            prune(q, now);
            return q.isEmpty();
        });
    }

    synchronized int trackedKeys() {
        return accountBuckets.size() + identifierBuckets.size() + soCap + ipFails.size();
    }

    /** "a:<id tài khoản>" hoặc "i:<băm chuỗi nhập>"; null khi không có gì để đếm. */
    private static String khoaChuThe(String identifier, Integer accountId) {
        if (accountId != null) return "a:" + accountId;
        String key = identifierKey(identifier);
        return key == null ? null : "i:" + key;
    }

    private Bucket bucketFor(String khoaChuThe, Integer accountId) {
        if (accountId != null) {
            return accountBuckets.computeIfAbsent(accountId, k -> new Bucket());
        }
        String key = khoaChuThe.substring(2);
        Bucket b = identifierBuckets.get(key);
        if (b == null) {
            if (identifierBuckets.size() >= maxIdentifierKeys) return null; // đầy trần: không đếm chuỗi mới
            b = new Bucket();
            identifierBuckets.put(key, b);
        }
        return b;
    }

    /** Bộ đếm cặp đã có (không tạo mới). */
    private Bucket capDaCo(String khoaChuThe, String ip) {
        Map<String, Bucket> theoIp = pairBuckets.get(khoaChuThe);
        return theoIp == null ? null : theoIp.get(ip);
    }

    private Bucket bucketCap(String khoaChuThe, String ip) {
        Map<String, Bucket> theoIp = pairBuckets.get(khoaChuThe);
        Bucket b = theoIp == null ? null : theoIp.get(ip);
        if (b == null) {
            if (soCap >= MAX_PAIR_KEYS) return null; // đầy trần: cặp mới không được đếm, ngưỡng tài khoản vẫn chặn
            b = new Bucket();
            pairBuckets.computeIfAbsent(khoaChuThe, k -> new HashMap<>()).put(ip, b);
            soCap++;
        }
        return b;
    }

    private static boolean hetHan(Bucket b, Instant now) {
        prune(b.attempts, now);
        boolean locked = b.lockedUntil != null && now.isBefore(b.lockedUntil);
        boolean nhoMucKhoa = b.lockCount > 0 && b.lastAttempt != null && now.isBefore(b.lastAttempt.plus(RESET_AFTER));
        return !locked && b.attempts.isEmpty() && !nhoMucKhoa;
    }

    private static long remaining(Bucket b, Instant now) {
        if (b.lockedUntil == null || !now.isBefore(b.lockedUntil)) return 0;
        long millis = Duration.between(now, b.lockedUntil).toMillis();
        return Math.max(1, (millis + 999) / 1000); // làm tròn lên, tối thiểu 1 giây
    }

    private static void prune(Deque<Instant> q, Instant now) {
        Instant threshold = now.minus(WINDOW);
        while (!q.isEmpty() && !q.peekFirst().isAfter(threshold)) {
            q.pollFirst();
        }
    }

    /**
     * Khoá của chuỗi nhập: bỏ dấu, ký tự định dạng (zero-width), không phân biệt hoa thường — gần với cách collation
     * utf8mb4_unicode_ci so khớp — rồi băm SHA-256 lấy 16 byte, để độ dài cố định.
     */
    static String identifierKey(String identifier) {
        if (identifier == null || identifier.isBlank()) return null;
        String chuan = Normalizer.normalize(identifier.trim(), Normalizer.Form.NFKD)
                .replaceAll("[\\p{M}\\p{Cf}]", "")
                .toLowerCase(Locale.ROOT);
        try {
            byte[] bam = MessageDigest.getInstance("SHA-256").digest(chuan.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(Arrays.copyOf(bam, 16));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("JVM thiếu SHA-256", e);
        }
    }
}
