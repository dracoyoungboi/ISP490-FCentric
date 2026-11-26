package com.dev.backend.services.omnichannel;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bộ theo dõi tỷ lệ sử dụng hạn mức API (Leaky Bucket / Rate Limit Utilization) của từng kênh TMĐT
 * và cơ chế điều tiết (Throttling Guard):
 * khi {@code RateLimitUtilization >= 85%}, chèn trễ {@code +500ms} cho luồng {@code SCHEDULED_BATCH},
 * tuyệt đối không trì hoãn {@code REALTIME_CRITICAL}.
 */
@Component
@Slf4j
public class OmnichannelRateLimitState {

    public static final double THROTTLE_THRESHOLD_PCT = 85.0d;
    public static final long SCHEDULED_THROTTLE_DELAY_MS = 500L;
    public static final int DEFAULT_CALLS_PER_MINUTE = 120;
    private static final long BUCKET_TTL_SECONDS = 60L;
    private static final Pattern RATIO_PATTERN = Pattern.compile("(\\d+)\\s*/\\s*(\\d+)");

    public record BucketSnapshot(int used, int limit, double utilizationPct, Instant updatedAt) {}

    private final Map<String, BucketSnapshot> buckets = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> rollingWindowCalls = new ConcurrentHashMap<>();

    /**
     * Cập nhật phần trăm sử dụng hạn mức API của một sàn sau mỗi response HTTP:
     * - Gặp 429: đánh dấu bucket 100% ngay để kích hoạt cơ chế giãn nhịp.
     * - Shopify có header {@code X-Shopify-Shop-Api-Call-Limit} (dạng {@code 32/40}) -> parse trực tiếp.
     * - Sàn khác (Shopee/Lazada/TikTok) -> đếm số request trong cửa sổ trượt 60s gần nhất chia cho trần 120 RPM.
     */
    public void updateFromHeader(String channelCode, String callLimitHeader, int httpStatus) {
        if (channelCode == null || channelCode.isBlank()) return;
        String key = normalizeChannel(channelCode);
        Instant now = Instant.now();
        if (httpStatus == 429) {
            buckets.put(key, new BucketSnapshot(40, 40, 100.0d, now));
            return;
        }
        if (callLimitHeader != null && !callLimitHeader.isBlank()) {
            Matcher m = RATIO_PATTERN.matcher(callLimitHeader);
            if (m.find()) {
                try {
                    int used = Integer.parseInt(m.group(1));
                    int limit = Integer.parseInt(m.group(2));
                    if (limit > 0) {
                        double pct = Math.min(100.0d, Math.round((used * 10000.0d / limit)) / 100.0d);
                        buckets.put(key, new BucketSnapshot(used, limit, pct, now));
                        return;
                    }
                } catch (NumberFormatException ignored) {
                }
            }
        }
        // Sàn không trả header bucket (Shopee / Lazada / TikTok): tính theo số request trong 60 giây gần nhất / 120 rpm
        Deque<Instant> window = rollingWindowCalls.computeIfAbsent(key, k -> new ArrayDeque<>());
        int usedInMinute;
        synchronized (window) {
            window.addLast(now);
            Instant cutoff = now.minusSeconds(BUCKET_TTL_SECONDS);
            while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
                window.pollFirst();
            }
            usedInMinute = window.size();
        }
        double pct = Math.min(100.0d, Math.round((usedInMinute * 10000.0d / DEFAULT_CALLS_PER_MINUTE)) / 100.0d);
        buckets.put(key, new BucketSnapshot(usedInMinute, DEFAULT_CALLS_PER_MINUTE, pct, now));
    }

    public double getUtilizationPct(String channelCode) {
        if (channelCode == null || channelCode.isBlank()) return 0.0d;
        BucketSnapshot snap = buckets.get(normalizeChannel(channelCode));
        if (snap == null) return 0.0d;
        long ageSeconds = Duration.between(snap.updatedAt(), Instant.now()).getSeconds();
        if (ageSeconds > BUCKET_TTL_SECONDS) {
            return 0.0d;
        }
        return snap.utilizationPct();
    }

    public BucketSnapshot getSnapshot(String channelCode) {
        if (channelCode == null || channelCode.isBlank()) return null;
        return buckets.get(normalizeChannel(channelCode));
    }

    public Map<String, BucketSnapshot> snapshotAll() {
        return Map.copyOf(buckets);
    }

    public boolean shouldThrottleScheduledBatch(String channelCode) {
        return getUtilizationPct(channelCode) >= THROTTLE_THRESHOLD_PCT;
    }

    /**
     * Chỉ chèn trễ +500ms cho luồng batch định kỳ ({@code SCHEDULED_BATCH}) khi mức dùng rate limit >= 85%.
     */
    public boolean throttleBatchIfNeeded(String channelCode, String jobType) {
        if (!OmnichannelTelemetryContext.JOB_SCHEDULED_BATCH.equals(jobType)) {
            return false;
        }
        if (!shouldThrottleScheduledBatch(channelCode)) {
            return false;
        }
        try {
            log.warn("[THROTTLING-GUARD] Kênh {} đang dùng {}% hạn mức API (>= {}%). Tạm trễ +{}ms cho lô đồng bộ định kỳ.",
                    channelCode, getUtilizationPct(channelCode), THROTTLE_THRESHOLD_PCT, SCHEDULED_THROTTLE_DELAY_MS);
            Thread.sleep(SCHEDULED_THROTTLE_DELAY_MS);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private static String normalizeChannel(String code) {
        String c = code.trim().toUpperCase(Locale.ROOT);
        if (c.contains("SHOPEE")) return c.contains("SANDBOX") ? "SHOPEE_SANDBOX" : "SHOPEE";
        if (c.contains("SHOPIFY")) return "SHOPIFY";
        if (c.contains("LAZADA")) return c.contains("SANDBOX") ? "LAZADA_SANDBOX" : "LAZADA";
        if (c.contains("TIKTOK")) return "TIKTOK";
        return c;
    }
}

