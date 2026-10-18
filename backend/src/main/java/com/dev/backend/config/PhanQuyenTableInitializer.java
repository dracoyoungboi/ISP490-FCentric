package com.dev.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Tự tạo phần CSDL cho phân quyền khi máy chủ khởi động (cùng cách các *TableInitializer khác,
 * vì spring.jpa.hibernate.ddl-auto=none):
 * <ul>
 *   <li>Bảng mau_quyen_vai_tro: mẫu quyền của từng vai trò. Bảng rỗng thì nạp mẫu ban đầu (một lần).
 *       Sau đó quản trị viên sửa qua API, máy chủ không ghi đè.</li>
 *   <li>Cột quyen_han.nhay_cam: chỉ khi vừa thêm cột mới đánh dấu các quyền nhạy cảm ban đầu.</li>
 * </ul>
 * Có thể chạy tay bằng Database/migration-2026-10-18-phan-quyen.sql.
 */
@Component
@Slf4j
public class PhanQuyenTableInitializer implements ApplicationRunner {

    /** Mẫu ban đầu, theo mã quyền trong bảng quyen_han. Chỉ dùng khi bảng mẫu còn rỗng. */
    static final Map<String, List<String>> MAU_BAN_DAU = Map.of(
            "quan_ly_kho", List.of("xem_ton_kho", "xem_chi_tiet_lo", "dieu_chinh_ton_kho", "chuyen_kho",
                    "duyet_phieu_nhap", "huy_phieu_nhap", "duyet_phieu_xuat", "huy_phieu_xuat",
                    "xem_bao_cao_ton_kho", "xem_bao_cao_nhap_xuat", "xem_bao_cao_doanh_thu", "xuat_bao_cao",
                    "quan_ly_nhan_vien_kho", "cap_quyen_nhan_vien"),
            "nhan_vien_kho", List.of("xem_ton_kho", "xem_chi_tiet_lo", "chuyen_kho",
                    "tao_phieu_nhap", "tao_phieu_xuat", "xem_bao_cao_ton_kho"),
            "nhan_vien_mua_hang", List.of("xem_ton_kho", "tao_don_mua_hang", "xem_bao_cao_ton_kho",
                    "quan_ly_nha_cung_cap"),
            "nhan_vien_ban_hang", List.of("xem_ton_kho", "tao_don_ban_hang", "xem_bao_cao_ton_kho",
                    "quan_ly_khach_hang"));

    /** Quyền nhạy cảm ban đầu: duyệt, hủy, điều chỉnh tồn, báo cáo tiền, quản lý và cấp quyền nhân viên. */
    static final List<String> NHAY_CAM_BAN_DAU = List.of("dieu_chinh_ton_kho", "duyet_don_mua_hang",
            "duyet_phieu_nhap", "huy_phieu_nhap", "duyet_don_ban_hang", "duyet_phieu_xuat", "huy_phieu_xuat",
            "xem_bao_cao_doanh_thu", "xuat_bao_cao", "quan_ly_nhan_vien_kho", "cap_quyen_nhan_vien");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        taoBangMauQuyen();
        themCotNhayCam();
    }

    void taoBangMauQuyen() {
        try {
            // Chỉ nạp mẫu ban đầu khi bảng vừa được tạo: admin cố ý để trống mọi mẫu thì khởi động lại không nạp lại
            Integer daCoBang = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.TABLES "
                    + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mau_quyen_vai_tro'", Integer.class);
            boolean bangMoi = daCoBang == null || daCoBang == 0;
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS mau_quyen_vai_tro (
                    vai_tro VARCHAR(30) NOT NULL,
                    quyen_han_id INT NOT NULL,
                    PRIMARY KEY (vai_tro, quyen_han_id),
                    INDEX idx_mqvt_quyen (quyen_han_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """);
            if (bangMoi) {
                for (Map.Entry<String, List<String>> mau : MAU_BAN_DAU.entrySet()) {
                    String dauHoi = String.join(",", Collections.nCopies(mau.getValue().size(), "?"));
                    Object[] thamSo = new Object[mau.getValue().size() + 1];
                    thamSo[0] = mau.getKey();
                    for (int i = 0; i < mau.getValue().size(); i++) {
                        thamSo[i + 1] = mau.getValue().get(i);
                    }
                    jdbcTemplate.update("INSERT INTO mau_quyen_vai_tro (vai_tro, quyen_han_id) "
                            + "SELECT ?, id FROM quyen_han WHERE ma_quyen IN (" + dauHoi + ")", thamSo);
                }
                log.info("[TABLE-INIT] Đã nạp mẫu quyền ban đầu cho {} vai trò", MAU_BAN_DAU.size());
            }
        } catch (Exception e) {
            log.warn("[TABLE-INIT] Không thể khởi tạo bảng `mau_quyen_vai_tro`: {}", e.getMessage());
        }
    }

    void themCotNhayCam() {
        try {
            Integer coCot = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.COLUMNS "
                    + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quyen_han' AND COLUMN_NAME = 'nhay_cam'",
                    Integer.class);
            if (coCot != null && coCot > 0) {
                return;
            }
            jdbcTemplate.execute("ALTER TABLE quyen_han ADD COLUMN nhay_cam TINYINT(1) NOT NULL DEFAULT 0");
            String dauHoi = String.join(",", Collections.nCopies(NHAY_CAM_BAN_DAU.size(), "?"));
            jdbcTemplate.update("UPDATE quyen_han SET nhay_cam = 1 WHERE ma_quyen IN (" + dauHoi + ")",
                    NHAY_CAM_BAN_DAU.toArray());
            log.info("[TABLE-INIT] Đã thêm cột `nhay_cam` vào bảng `quyen_han` và đánh dấu {} quyền nhạy cảm",
                    NHAY_CAM_BAN_DAU.size());
        } catch (Exception e) {
            log.warn("[TABLE-INIT] Không thể thêm cột `nhay_cam` vào bảng `quyen_han`: {}", e.getMessage());
        }
    }
}
