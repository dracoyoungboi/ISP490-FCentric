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
        nangCapKieuCotKenhBanHang();
    }

    private void nangCapKieuCotKenhBanHang() {
        nangCapCotSangText("kenh_ban_hang", "api_key");
        nangCapCotSangText("kenh_ban_hang", "api_secret");
        nangCapCotSangText("kenh_ban_hang", "refresh_token");
        nangCapCotSangText("kenh_ban_hang", "api_url");
        nangCapCotSangDateTime("kenh_ban_hang", "token_expires_at");
        themCotBangKenhBanHang("shop_cipher", "VARCHAR(255) NULL");
    }

    private void themCotBangKenhBanHang(String tenCot, String kieuDuLieu) {
        try {
            String checkSql = "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kenh_ban_hang' AND COLUMN_NAME = ?";
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, tenCot);
            if (count == null || count == 0) {
                String alterSql = "ALTER TABLE kenh_ban_hang ADD COLUMN " + tenCot + " " + kieuDuLieu;
                jdbcTemplate.execute(alterSql);
                log.info("[TABLE-INIT] Đã bổ sung tự động cột `{}` vào bảng `kenh_ban_hang`", tenCot);
            }
        } catch (Exception e) {
            log.warn("[TABLE-INIT] Không thể tự động bổ sung cột `{}` vào bảng `kenh_ban_hang`: {}", tenCot, e.getMessage());
        }
    }

    private void nangCapCotSangDateTime(String tenBang, String tenCot) {
        try {
            String checkSql = "SELECT DATA_TYPE FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";
            String dataType = jdbcTemplate.queryForObject(checkSql, String.class, tenBang, tenCot);
            if (dataType != null && "timestamp".equalsIgnoreCase(dataType)) {
                String alterSql = "ALTER TABLE " + tenBang + " MODIFY COLUMN " + tenCot + " DATETIME(6) NULL";
                jdbcTemplate.execute(alterSql);
                log.info("[TABLE-INIT] Đã nâng cấp kiểu cột `{}` trong bảng `{}` từ TIMESTAMP sang DATETIME(6) NULL", tenCot, tenBang);
            }
        } catch (Exception e) {
            log.warn("[TABLE-INIT] Không thể tự động nâng cấp kiểu cột `{}` sang DATETIME trong bảng `{}`: {}", tenCot, tenBang, e.getMessage());
        }
    }

    private void nangCapCotSangText(String tenBang, String tenCot) {
        try {
            String checkSql = "SELECT DATA_TYPE FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";
            String dataType = jdbcTemplate.queryForObject(checkSql, String.class, tenBang, tenCot);
            if (dataType != null && !"text".equalsIgnoreCase(dataType) && !"mediumtext".equalsIgnoreCase(dataType) && !"longtext".equalsIgnoreCase(dataType)) {
                String alterSql = "ALTER TABLE " + tenBang + " MODIFY COLUMN " + tenCot + " TEXT NULL";
                jdbcTemplate.execute(alterSql);
                log.info("[TABLE-INIT] Đã nâng cấp kiểu cột `{}` trong bảng `{}` lên TEXT (Hỗ trợ mã hóa token dài)", tenCot, tenBang);
            }
        } catch (Exception e) {
            log.warn("[TABLE-INIT] Không thể tự động nâng cấp kiểu cột `{}` trong bảng `{}`: {}", tenCot, tenBang, e.getMessage());
        }
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

