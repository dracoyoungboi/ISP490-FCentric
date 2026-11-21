package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Bản ghi telemetry hiệu năng tích hợp sàn TMĐT (Độ trễ API, HTTP Status, Rate Limit Bucket, Error Category).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "lich_su_dong_bo_metric")
public class LichSuDongBoMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "channel", nullable = false, length = 30)
    String channel;

    @NotNull
    @Size(max = 30)
    @Column(name = "sync_direction", nullable = false, length = 30)
    String syncDirection;

    @NotNull
    @Size(max = 30)
    @Column(name = "trigger_source", nullable = false, length = 30)
    String triggerSource;

    @NotNull
    @Column(name = "latency_ms", nullable = false)
    Integer latencyMs;

    @Column(name = "http_status")
    Integer httpStatus;

    @NotNull
    @Size(max = 50)
    @Column(name = "error_category", nullable = false, length = 50)
    String errorCategory;

    @Column(name = "bucket_used")
    Integer bucketUsed;

    @Column(name = "bucket_max")
    Integer bucketMax;

    @NotNull
    @Builder.Default
    @Column(name = "records_processed", nullable = false)
    Integer recordsProcessed = 0;

    @NotNull
    @Builder.Default
    @Column(name = "created_at", nullable = false)
    Instant createdAt = Instant.now();
}

