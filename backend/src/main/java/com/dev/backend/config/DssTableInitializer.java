package com.dev.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Tự động khởi tạo bảng telemetry {@code lich_su_dong_bo_metric} và 2 cột cấu hình Buffer % / Real-time threshold
 * trên {@code trang_thai_dong_bo_san_pham}, đảm bảo an toàn với {@code spring.jpa.hibernate.ddl-auto=none}.
 */
@Component
@Slf4j
public class DssTableInitializer implements ApplicationRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        taoBangMetricNeuChuaCo();
        themCotDongBoNeuChuaCo("buffer_percent", "INT DEFAULT NULL");
        themCotDongBoNeuChuaCo("realtime_threshold", "INT DEFAULT NULL");
    }

    private void taoBangMetricNeuChuaCo() {
        try {
            jdbcTemplate.execute("""
                    CREATE TABLE IF NOT EXISTS lich_su_dong_bo_metric (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        channel VARCHAR(30) NOT NULL,
                        sync_direction VARCHAR(30) NOT NULL,
                        trigger_source VARCHAR(30) NOT NULL,
                        latency_ms INT NOT NULL,
                        http_status INT NULL,
                        error_category VARCHAR(50) NOT NULL,
                        bucket_used INT NULL,
                        bucket_max INT NULL,
                        records_processed INT NOT NULL DEFAULT 0,
                        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                        INDEX idx_metric_channel_time (channel, created_at),
                        INDEX idx_metric_direction_time (sync_direction, created_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """);
        } catch (Exception e) {
            log.warn("[DSS-INIT] Không thể tự động khởi tạo bảng `lich_su_dong_bo_metric`: {}", e.getMessage());
        }
    }

    private void themCotDongBoNeuChuaCo(String tenCot, String kieuDuLieu) {
        try {
            String checkSql = "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trang_thai_dong_bo_san_pham' AND COLUMN_NAME = ?";
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, tenCot);
            if (count == null || count == 0) {
                jdbcTemplate.execute("ALTER TABLE trang_thai_dong_bo_san_pham ADD COLUMN " + tenCot + " " + kieuDuLieu);
                log.info("[DSS-INIT] Đã bổ sung tự động cột `{}` vào `trang_thai_dong_bo_san_pham`", tenCot);
            }
        } catch (Exception e) {
            log.warn("[DSS-INIT] Không thể tự động bổ sung cột `{}` vào `trang_thai_dong_bo_san_pham`: {}", tenCot, e.getMessage());
        }
    }
}

