package com.dev.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Tự động kiểm tra và khởi tạo các cột mới cho bảng trang_thai_dong_bo_san_pham
 * đảm bảo hệ thống không bị crash runtime khi môi trường chưa chạy file SQL migration thủ công.
 */
@Component
@Slf4j
public class TrangThaiDongBoTableInitializer implements ApplicationRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        themCotNeuChuaTonTai("so_luong_da_day", "INT DEFAULT NULL");
        themCotNeuChuaTonTai("ngay_day_ton_cuoi", "DATETIME DEFAULT NULL");
    }

    private void themCotNeuChuaTonTai(String tenCot, String kieuDuLieu) {
        try {
            String checkSql = "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trang_thai_dong_bo_san_pham' AND COLUMN_NAME = ?";
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, tenCot);
            if (count == null || count == 0) {
                String alterSql = "ALTER TABLE trang_thai_dong_bo_san_pham ADD COLUMN " + tenCot + " " + kieuDuLieu;
                jdbcTemplate.execute(alterSql);
                log.info("[TABLE-INIT] Đã bổ sung tự động cột `{}` vào bảng `trang_thai_dong_bo_san_pham`", tenCot);
            }
        } catch (Exception e) {
            log.warn("[TABLE-INIT] Không thể tự động bổ sung cột `{}`: {}", tenCot, e.getMessage());
        }
    }
}

