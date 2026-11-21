package com.dev.backend.services.omnichannel;

import com.dev.backend.entities.LichSuDongBoMetric;
import com.dev.backend.repository.LichSuDongBoMetricRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * Bộ ghi bất đồng bộ bản ghi telemetry {@link LichSuDongBoMetric} để không cản luồng đồng bộ sàn
 * và không làm gián đoạn giao dịch JPA chính khi đo lường API đối tác / webhook.
 */
@Component
@Slf4j
public class OmnichannelTelemetryRecorder {

    private final LichSuDongBoMetricRepository repository;
    private final OmnichannelRateLimitState rateLimitState;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "omni-telemetry-writer");
        t.setDaemon(true);
        return t;
    });

    public OmnichannelTelemetryRecorder(
            LichSuDongBoMetricRepository repository,
            OmnichannelRateLimitState rateLimitState) {
        this.repository = repository;
        this.rateLimitState = rateLimitState;
    }

    @PostConstruct
    void bindStaticBridge() {
        OmnichannelTelemetryInterceptor.bindBridge(this, rateLimitState);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public void recordAsync(
            String channel,
            String syncDirection,
            String triggerSource,
            int latencyMs,
            Integer httpStatus,
            String errorCategory,
            Integer bucketUsed,
            Integer bucketMax,
            int recordsProcessed) {
        LichSuDongBoMetric metric = LichSuDongBoMetric.builder()
                .channel(truncate(channel, 30, "OMNICHANNEL"))
                .syncDirection(truncate(syncDirection, 30, "OTHER"))
                .triggerSource(truncate(triggerSource, 30, OmnichannelTelemetryContext.JOB_MANUAL))
                .latencyMs(Math.max(0, latencyMs))
                .httpStatus(httpStatus)
                .errorCategory(truncate(errorCategory, 50, "NONE"))
                .bucketUsed(bucketUsed)
                .bucketMax(bucketMax)
                .recordsProcessed(Math.max(0, recordsProcessed))
                .createdAt(Instant.now())
                .build();
        try {
            executor.submit(() -> {
                try {
                    repository.save(metric);
                } catch (Exception e) {
                    log.debug("[TELEMETRY] Bỏ qua lỗi lưu metric kênh {}: {}", metric.getChannel(), e.getMessage());
                }
            });
        } catch (RejectedExecutionException ignored) {
        }
    }

    private static String truncate(String val, int maxLen, String fallback) {
        if (val == null || val.isBlank()) {
            return fallback;
        }
        String trimmed = val.trim();
        return trimmed.length() <= maxLen ? trimmed : trimmed.substring(0, maxLen);
    }
}

