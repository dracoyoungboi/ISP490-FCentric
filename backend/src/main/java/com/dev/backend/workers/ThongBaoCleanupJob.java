package com.dev.backend.workers;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Dọn thông báo (bảng thong_bao) cũ hơn 90 ngày, đã đọc hay chưa. Chỉ xóa dòng do chuông ghi (có khoa_su_kien), không đụng
 * dòng có sẵn từ trước. Hằng ngày lúc 3:15 (0 15 3 * * ?), giữa JOB-04 (3:00)
 * và JOB-05 (3:30). Xóa từng đợt tối đa 5.000 dòng để không khóa bảng lâu.
 * Localhost và production dùng chung CSDL nên job có thể chạy hai lần cùng đêm: câu DELETE chỉ theo mốc ngày, lần sau
 * không còn dòng nào khớp, vô hại. Chưa chạy migration-2026-10-28-thong-bao.sql (thiếu cột khoa_su_kien) thì chỉ ghi log.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ThongBaoCleanupJob {

    static final int SO_NGAY_LUU = 90;
    static final int SO_DONG_MOI_DOT = 5000;
    static final String SQL_XOA = "DELETE FROM thong_bao WHERE ngay_tao < ? AND khoa_su_kien IS NOT NULL LIMIT ?";

    JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 15 3 * * ?")
    public void donThongBaoCu() {
        Instant moc = Instant.now().minus(SO_NGAY_LUU, ChronoUnit.DAYS);
        int tong = 0;
        int dot = 0;
        try {
            while (true) {
                int daXoa = jdbcTemplate.update(SQL_XOA, moc, SO_DONG_MOI_DOT);
                tong += daXoa;
                dot++;
                if (daXoa < SO_DONG_MOI_DOT) break;
            }
            log.info("[THONG-BAO] Đã xóa {} thông báo tạo trước {} qua {} đợt", tong, moc, dot);
        } catch (Exception e) {
            log.error("[THONG-BAO] Lỗi dọn thông báo cũ (đã xóa {} dòng): {}", tong, e.getMessage());
        }
    }
}
