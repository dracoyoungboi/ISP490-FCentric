package com.dev.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class BangChungDongGoiTableInitializer implements ApplicationRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            String sql = "CREATE TABLE IF NOT EXISTS bang_chung_dong_goi (" +
                    "  id INT AUTO_INCREMENT PRIMARY KEY," +
                    "  don_ban_hang_id INT NOT NULL," +
                    "  phieu_xuat_kho_id INT NULL," +
                    "  pick_list_id INT NULL," +
                    "  tep_tin_id INT NOT NULL," +
                    "  loai_bang_chung VARCHAR(50) NOT NULL," +
                    "  loai_tep VARCHAR(20) NOT NULL," +
                    "  thoi_luong_giay INT NULL," +
                    "  kich_thuoc_bytes BIGINT NULL," +
                    "  duong_dan_minio VARCHAR(1000) NOT NULL," +
                    "  nguoi_tao_id INT NULL," +
                    "  ngay_tao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "  ngay_het_han TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "  trang_thai TINYINT NOT NULL DEFAULT 1," +
                    "  ghi_chu VARCHAR(500) NULL," +
                    "  INDEX idx_bcdg_don (don_ban_hang_id)," +
                    "  INDEX idx_bcdg_phieu (phieu_xuat_kho_id)," +
                    "  INDEX idx_bcdg_cleanup (trang_thai, ngay_het_han)" +
                    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
            jdbcTemplate.execute(sql);
            log.info("[TABLE-INIT] Khởi tạo an toàn bảng bang_chung_dong_goi thành công");
        } catch (Exception e) {
            log.warn("[TABLE-INIT] Không thể tự động tạo bảng bang_chung_dong_goi: {}", e.getMessage());
        }
    }
}
