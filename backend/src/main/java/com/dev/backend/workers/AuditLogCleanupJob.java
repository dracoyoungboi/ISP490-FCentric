package com.dev.backend.workers;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import com.dev.backend.constant.variables.IHanhDong;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;

/**
 * JOB-04 (SRS 12.4): Clean Up Old Audit Log Entries.
 * Trigger: Hằng ngày lúc 3:00 AM (0 0 3 * * ?).
 * Retention period: 90 ngày.
 * Không xóa các hành động trong {@link IHanhDong#KHONG_TU_DON}: lịch sử phiên bản mẫu in (các phiên bản cấu hình để
 * xem lại / khôi phục, mỗi lần lưu mẫu một dòng nên không phình bảng) và nhật ký bảo mật (đăng nhập, khóa tài khoản,
 * mật khẩu, đổi quyền, đổi khóa thanh toán) cần giữ để truy vết sự cố.
 * Xóa theo batch tối đa 5,000 dòng để tránh lock bảng DB trong thời gian dài.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuditLogCleanupJob {

    JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanUpOldAuditLogs() {
        Instant threshold = Instant.now().minus(90, ChronoUnit.DAYS);
        log.info("[JOB-04] Bắt đầu dọn dẹp Audit Log cũ trước {}", threshold);

        int totalDeleted = 0;
        int batchCount = 0;
        int batchSize = 5000;

        List<String> giuLai = IHanhDong.KHONG_TU_DON;
        String sql = "DELETE FROM lich_su_thay_doi WHERE ngay_thuc_hien < ?"
                + " AND (hanh_dong IS NULL OR hanh_dong NOT IN ("
                + String.join(", ", Collections.nCopies(giuLai.size(), "?")) + ")) LIMIT ?";
        Object[] thamSo = new Object[giuLai.size() + 2];
        thamSo[0] = threshold;
        for (int i = 0; i < giuLai.size(); i++) thamSo[i + 1] = giuLai.get(i);
        thamSo[thamSo.length - 1] = batchSize;

        try {
            while (true) {
                // Xóa từng đợt 5,000 dòng có thời gian cũ hơn 90 ngày (trừ phiên bản mẫu in và nhật ký bảo mật)
                int deleted = jdbcTemplate.update(sql, thamSo);
                totalDeleted += deleted;
                batchCount++;

                if (deleted < batchSize) {
                    break;
                }
            }
            log.info("[JOB-04] Đã dọn dẹp thành công {} bản ghi Audit Log qua {} đợt", totalDeleted, batchCount);
        } catch (Exception e) {
            log.error("[JOB-04] Lỗi dọn dẹp Audit Log: {}", e.getMessage());
        }
    }
}

