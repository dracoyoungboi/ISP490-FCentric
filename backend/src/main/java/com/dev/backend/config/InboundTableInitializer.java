package com.dev.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Tự động khởi tạo và cập nhật schema DB cho phân hệ New Inbound:
 * Khu vực kho, Vị trí kệ, Mặt bằng kho, Mã vạch NCC, Tồn kho vị trí, Biên bản RTV, và bổ sung cột cho lo_hang, chi_tiet_phieu_nhap_kho.
 */
@Component
@Slf4j
public class InboundTableInitializer implements ApplicationRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        log.info("[INBOUND-INIT] Bắt đầu kiểm tra và khởi tạo schema cho New Inbound...");
        try {
            // 1. Khu vực kho
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS khu_vuc_kho (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    kho_id INT NOT NULL,
                    ma_khu_vuc VARCHAR(50) NOT NULL,
                    ten_khu_vuc VARCHAR(100) NOT NULL,
                    loai_khu VARCHAR(50) DEFAULT 'LUU_KHO',
                    ghi_chu TEXT,
                    trang_thai TINYINT DEFAULT 1,
                    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_kho_khu_vuc (kho_id, ma_khu_vuc),
                    INDEX idx_kvk_kho (kho_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """);

            // 2. Vị trí kho (Kệ / Bin)
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS vi_tri_kho (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    kho_id INT NOT NULL,
                    khu_vuc_kho_id INT NOT NULL,
                    ma_vi_tri VARCHAR(50) NOT NULL,
                    day_ke VARCHAR(20) NULL,
                    hang_ke VARCHAR(20) NULL,
                    tang_ke VARCHAR(20) NULL,
                    suc_chua_toi_da INT DEFAULT 100,
                    trang_thai VARCHAR(30) DEFAULT 'HOAT_DONG',
                    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_kho_vi_tri (kho_id, ma_vi_tri),
                    INDEX idx_vtk_kho (kho_id),
                    INDEX idx_vtk_khuvuc (khu_vuc_kho_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """);

            // 3. Mặt bằng kho
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS mat_bang_kho (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    kho_id INT NOT NULL UNIQUE,
                    so_cot INT DEFAULT 20,
                    so_hang INT DEFAULT 20,
                    cau_hinh_json LONGTEXT NOT NULL,
                    ngay_cap_nhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_mbk_kho (kho_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """);

            // 4. Mã vạch Nhà cung cấp
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ma_vach_nha_cung_cap (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nha_cung_cap_id INT NOT NULL,
                    bien_the_san_pham_id INT NOT NULL,
                    barcode_ncc VARCHAR(100) NOT NULL,
                    ma_san_pham_ncc VARCHAR(100) NULL,
                    phieu_nhap_kho_id INT NULL,
                    ghi_chu VARCHAR(255) NULL,
                    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_ncc_barcode (nha_cung_cap_id, barcode_ncc),
                    INDEX idx_mvncc_barcode (barcode_ncc),
                    INDEX idx_mvncc_bt (bien_the_san_pham_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """);

            // 5. Tồn kho theo Vị trí kệ
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ton_kho_vi_tri (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    vi_tri_kho_id INT NOT NULL,
                    lo_hang_id INT NOT NULL,
                    bien_the_san_pham_id INT NOT NULL,
                    so_luong INT NOT NULL DEFAULT 0,
                    ngay_cap_nhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_vi_tri_lo (vi_tri_kho_id, lo_hang_id),
                    INDEX idx_tkvt_vitri (vi_tri_kho_id),
                    INDEX idx_tkvt_lo (lo_hang_id),
                    INDEX idx_tkvt_bt (bien_the_san_pham_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """);

            // 6. Biên bản trả hàng NCC
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS bien_ban_tra_hang_ncc (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ma_bien_ban VARCHAR(50) NOT NULL UNIQUE,
                    phieu_nhap_kho_id INT NOT NULL,
                    nha_cung_cap_id INT NOT NULL,
                    nguoi_tao_id INT NOT NULL,
                    tong_so_luong_loi INT NOT NULL DEFAULT 0,
                    phuong_an_xu_ly VARCHAR(50) DEFAULT 'DOI_HANG_MOI',
                    trang_thai VARCHAR(50) DEFAULT 'CHO_TRA_HANG',
                    ghi_chu TEXT,
                    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_rtv_phieu (phieu_nhap_kho_id),
                    INDEX idx_rtv_ncc (nha_cung_cap_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """);

            // 7. Chi tiết trả hàng NCC
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS chi_tiet_tra_hang_ncc (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    bien_ban_tra_hang_ncc_id INT NOT NULL,
                    bien_the_san_pham_id INT NOT NULL,
                    lo_hang_id INT NULL,
                    ma_lo VARCHAR(50) NULL,
                    so_luong_loi INT NOT NULL,
                    ly_do_loi VARCHAR(50) NOT NULL,
                    anh_bang_chung_url VARCHAR(500) NULL,
                    ghi_chu VARCHAR(255) NULL,
                    INDEX idx_ctrtv_bb (bien_ban_tra_hang_ncc_id),
                    INDEX idx_ctrtv_bt (bien_the_san_pham_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """);

            // 8. Bổ sung cột cho bảng lo_hang
            themCotNeuChuaCo("lo_hang", "vi_tri_kho_id", "INT NULL");
            themCotNeuChuaCo("lo_hang", "so_luong_nhap", "INT DEFAULT 0");
            themCotNeuChuaCo("lo_hang", "so_luong_con_lai", "INT DEFAULT 0");
            themCotNeuChuaCo("lo_hang", "so_luong_loi", "INT DEFAULT 0");
            themCotNeuChuaCo("lo_hang", "trang_thai", "VARCHAR(30) DEFAULT 'HOAT_DONG'");

            // 9. Bổ sung cột cho bảng chi_tiet_phieu_nhap_kho
            themCotNeuChuaCo("chi_tiet_phieu_nhap_kho", "so_luong_yeu_cau", "INT DEFAULT 0");
            themCotNeuChuaCo("chi_tiet_phieu_nhap_kho", "so_luong_dat_qc", "INT DEFAULT 0");
            themCotNeuChuaCo("chi_tiet_phieu_nhap_kho", "so_luong_loi_qc", "INT DEFAULT 0");
            themCotNeuChuaCo("chi_tiet_phieu_nhap_kho", "trang_thai_kiem_dem", "VARCHAR(30) DEFAULT 'CHO_KIEM_DEM'");

            // 9b. Hàng không đạt theo lý do của từng lô (biên bản trả hàng đọc từ đây, không đọc từ trình duyệt)
            // Bọc riêng: tạo bảng có khóa ngoại lỗi thì bước 9c, 10 vẫn chạy (không thì mã vạch NCC thiếu cột)
            try {
                jdbcTemplate.execute("""
                    CREATE TABLE IF NOT EXISTS chi_tiet_loi_lo_hang (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        lo_hang_id INT NOT NULL,
                        ly_do VARCHAR(50) NOT NULL,
                        so_luong INT NOT NULL,
                        ghi_chu VARCHAR(255) NULL,
                        ngay_tao TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_ctllh_lo (lo_hang_id),
                        CONSTRAINT fk_ctllh_lo_hang FOREIGN KEY (lo_hang_id) REFERENCES lo_hang (id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """);
            } catch (Exception e) {
                log.warn("[INBOUND-INIT] Không thể tự động tạo bảng `chi_tiet_loi_lo_hang`: {}", e.getMessage());
            }

            // 9c. Người xác nhận liên kết mã vạch NCC lúc kiểm đếm
            themCotNeuChuaCo("ma_vach_nha_cung_cap", "nguoi_lien_ket_id", "INT NULL");

            // 10. Chuẩn hóa vị trí kệ theo từng Kho (uk_kho_vi_tri)
            chuanHoaViTriKhoTheoKho();

            log.info("[INBOUND-INIT] Khởi tạo schema New Inbound hoàn tất thành công!");
        } catch (Exception e) {
            log.error("[INBOUND-INIT] Lỗi khi khởi tạo schema New Inbound: {}", e.getMessage(), e);
        }
    }

    private void chuanHoaViTriKhoTheoKho() {
        try {
            // 1. Thêm cột kho_id nếu chưa có
            String checkCol = "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vi_tri_kho' AND COLUMN_NAME = 'kho_id'";
            Integer countCol = jdbcTemplate.queryForObject(checkCol, Integer.class);
            if (countCol == null || countCol == 0) {
                jdbcTemplate.execute("ALTER TABLE vi_tri_kho ADD COLUMN kho_id INT NULL");
                jdbcTemplate.execute("UPDATE vi_tri_kho v JOIN khu_vuc_kho k ON v.khu_vuc_kho_id = k.id SET v.kho_id = k.kho_id WHERE v.kho_id IS NULL");
                jdbcTemplate.execute("ALTER TABLE vi_tri_kho MODIFY COLUMN kho_id INT NOT NULL");
                log.info("[INBOUND-INIT] Đã bổ sung cột `kho_id` vào bảng `vi_tri_kho` và backfill dữ liệu theo khu vực");
            }

            // 2. Xóa index UNIQUE cũ trên ma_vi_tri nếu tồn tại
            String checkOldIdx = "SELECT COUNT(*) FROM information_schema.STATISTICS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vi_tri_kho' AND INDEX_NAME = 'ma_vi_tri' AND NON_UNIQUE = 0";
            Integer countOldIdx = jdbcTemplate.queryForObject(checkOldIdx, Integer.class);
            if (countOldIdx != null && countOldIdx > 0) {
                jdbcTemplate.execute("ALTER TABLE vi_tri_kho DROP INDEX ma_vi_tri");
                log.info("[INBOUND-INIT] Đã xóa chỉ mục UNIQUE toàn cục cũ `ma_vi_tri` trên bảng `vi_tri_kho`");
            }

            // 3. Thêm UNIQUE KEY uk_kho_vi_tri (kho_id, ma_vi_tri) nếu chưa có
            String checkNewIdx = "SELECT COUNT(*) FROM information_schema.STATISTICS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vi_tri_kho' AND INDEX_NAME = 'uk_kho_vi_tri'";
            Integer countNewIdx = jdbcTemplate.queryForObject(checkNewIdx, Integer.class);
            if (countNewIdx == null || countNewIdx == 0) {
                jdbcTemplate.execute("ALTER TABLE vi_tri_kho ADD UNIQUE KEY uk_kho_vi_tri (kho_id, ma_vi_tri)");
                log.info("[INBOUND-INIT] Đã thêm chỉ mục UNIQUE theo kho `uk_kho_vi_tri (kho_id, ma_vi_tri)` vào bảng `vi_tri_kho`");
            }

            // 4. Thêm INDEX idx_vtk_kho nếu chưa có
            String checkKhoIdx = "SELECT COUNT(*) FROM information_schema.STATISTICS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vi_tri_kho' AND INDEX_NAME = 'idx_vtk_kho'";
            Integer countKhoIdx = jdbcTemplate.queryForObject(checkKhoIdx, Integer.class);
            if (countKhoIdx == null || countKhoIdx == 0) {
                jdbcTemplate.execute("ALTER TABLE vi_tri_kho ADD INDEX idx_vtk_kho (kho_id)");
            }
        } catch (Exception e) {
            log.warn("[INBOUND-INIT] Không thể tự động chuẩn hóa vị trí kệ theo kho: {}", e.getMessage());
        }
    }

    private void themCotNeuChuaCo(String tenBang, String tenCot, String kieuDuLieu) {
        try {
            String checkSql = "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, tenBang, tenCot);
            if (count == null || count == 0) {
                String alterSql = "ALTER TABLE " + tenBang + " ADD COLUMN " + tenCot + " " + kieuDuLieu;
                jdbcTemplate.execute(alterSql);
                log.info("[INBOUND-INIT] Đã bổ sung cột `{}` vào bảng `{}`", tenCot, tenBang);
            }
        } catch (Exception e) {
            log.warn("[INBOUND-INIT] Không thể tự động bổ sung cột `{}` vào bảng `{}`: {}", tenCot, tenBang, e.getMessage());
        }
    }
}

