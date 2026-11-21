package com.dev.backend.dto.omnichannel;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OmnichannelAnalyticsOverviewDto {
    private String range;
    private String channel;
    private String calculatedAt;

    // KPI Cards (METRIC_01 .. METRIC_06)
    private double avgLatencyMs;
    private double p95LatencyMs;
    private double p99LatencyMs;
    private double webhookDelayAvgMs;
    private double webhookDelayP95Ms;
    private long webhookCount;
    private double syncSuccessRatePercent;
    private long totalCalls;
    private long successCalls;
    private long failedCalls;
    private double maxRateLimitUtilizationPercent;
    private boolean throttlingActive;
    private long oversellIncidenceCount;
    private double oversellRatePercent;
    private double avgOosRecoveryMinutes;

    private List<ChannelBucketStatusDto> channelBuckets;
    private List<ChannelMetricDto> channelStats;
    private List<ErrorCategoryCountDto> errorBreakdown;
    private List<LatencyTrendPointDto> latencyTrend;
    private List<RecentMetricLogDto> recentLogs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChannelBucketStatusDto {
        private String channel;
        private int used;
        private int max;
        private double utilizationPercent;
        private boolean throttlingActive;
        private String updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChannelMetricDto {
        private String channel;
        private long totalCalls;
        private long successCalls;
        private long failedCalls;
        private double successRatePercent;
        private double avgLatencyMs;
        private double p95LatencyMs;
        private double rateLimitUtilizationPercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ErrorCategoryCountDto {
        private String errorCategory;
        private long count;
        private double sharePercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LatencyTrendPointDto {
        private String bucket;
        private long callCount;
        private long errorCount;
        private double avgLatencyMs;
        private double p95LatencyMs;
        private double successRatePercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentMetricLogDto {
        private Long id;
        private String channel;
        private String syncDirection;
        private String triggerSource;
        private int latencyMs;
        private Integer httpStatus;
        private String errorCategory;
        private Integer bucketUsed;
        private Integer bucketMax;
        private String createdAt;
    }
}

