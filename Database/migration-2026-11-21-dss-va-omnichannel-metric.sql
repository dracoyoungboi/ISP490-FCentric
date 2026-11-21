-- Migration: Phân hệ Hỗ trợ Ra quyết định Nhập hàng Động (DSS) & Telemetry Đa kênh
-- Ngày: 2026-11-21
-- Lưu ý: DssTableInitializer.java cũng tự động đảm bảo các bảng/cột này khi khởi động ứng dụng (spring.jpa.hibernate.ddl-auto=none).

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mở rộng trang_thai_dong_bo_san_pham để lưu Buffer % & Ngưỡng Real-time động theo SKU (tương thích MySQL 8.0)
SET @col_buf = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trang_thai_dong_bo_san_pham' AND COLUMN_NAME = 'buffer_percent'
);
SET @sql_buf = IF(@col_buf = 0, 'ALTER TABLE trang_thai_dong_bo_san_pham ADD COLUMN buffer_percent INT NULL', 'SELECT 1');
PREPARE stmt_buf FROM @sql_buf;
EXECUTE stmt_buf;
DEALLOCATE PREPARE stmt_buf;

SET @col_rt = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trang_thai_dong_bo_san_pham' AND COLUMN_NAME = 'realtime_threshold'
);
SET @sql_rt = IF(@col_rt = 0, 'ALTER TABLE trang_thai_dong_bo_san_pham ADD COLUMN realtime_threshold INT NULL', 'SELECT 1');
PREPARE stmt_rt FROM @sql_rt;
EXECUTE stmt_rt;
DEALLOCATE PREPARE stmt_rt;

-- Khởi tạo an toàn cấu hình tham số DSS trong cau_hinh_he_thong
INSERT IGNORE INTO cau_hinh_he_thong (ma_cau_hinh, gia_tri, kieu_du_lieu, mo_ta, ngay_cap_nhat) VALUES
('DSS_REPLENISHMENT_MODE', 'BY_ABC_CLASS', 'STRING', 'Chế độ áp dụng kịch bản DSS (BY_ABC_CLASS hoặc GLOBAL_PRESET)', NOW()),
('DSS_GLOBAL_PRESET_CODE', 'PRESET_01_STANDARD', 'STRING', 'Mã kịch bản DSS toàn cục mặc định', NOW()),
('DSS_OBSERVATION_DAYS_N', '14', 'INT', 'Chu kỳ quan sát sức bán lịch sử N (ngày)', NOW()),
('DSS_SERVICE_LEVEL_Z', '1.65', 'DECIMAL', 'Hệ số mức độ phục vụ Z (90%=1.28, 95%=1.65, 97.5%=1.96, 99%=2.33)', NOW()),
('DSS_REPLENISHMENT_CYCLE_T', '14', 'INT', 'Chu kỳ dự trữ / nhập hàng T (ngày)', NOW()),
('DSS_PEAK_GROWTH_PERCENT_G', '30', 'INT', 'Tỷ lệ tăng trưởng dự phóng mùa cao điểm g (%)', NOW()),
('DSS_PEAK_CAMPAIGN_DAYS', '14', 'INT', 'Thời gian chiến dịch cao điểm T_campaign (ngày)', NOW()),
('DSS_LEAN_BUFFER_DAYS', '3', 'INT', 'Số ngày tồn đệm an toàn cho kịch bản Tinh gọn B_days (ngày)', NOW()),
('DSS_PHASEOUT_REMAINING_DAYS', '15', 'INT', 'Số ngày còn lại của mùa vụ cho kịch bản Xả hàng T_remaining (ngày)', NOW()),
('DSS_DEFAULT_LEAD_TIME_AVG', '5', 'INT', 'Lead Time trung bình mặc định khi chưa có lịch sử nhập (ngày)', NOW()),
('DSS_DEFAULT_LEAD_TIME_MAX', '7', 'INT', 'Lead Time tối đa mặc định khi chưa có lịch sử nhập (ngày)', NOW()),
('DSS_LEAD_TIME_SAMPLE_M', '10', 'INT', 'Số đơn mua gần nhất để tính Lead Time nhà cung cấp M', NOW());
