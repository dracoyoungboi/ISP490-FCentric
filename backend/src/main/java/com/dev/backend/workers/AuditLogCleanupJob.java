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
 * CHỈ xóa các hành động trong {@link IHanhDong#DUOC_DON} (quét mã, đồng bộ sàn: ghi rất nhiều, giá trị truy vết thấp).
 * Mọi hành động khác — duyệt / hủy / sửa chứng từ, bảo mật, phân quyền, dòng không có hành động — giữ lại: Luật Kế
 * toán 2015 Điều 41 yêu cầu lưu chứng từ kế toán tối thiểu 10 năm, tài liệu quản lý tối thiểu 5 năm.
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

        List<String> duocDon = IHanhDong.DUOC_DON;
        String sql = "DELETE FROM lich_su_thay_doi WHERE ngay_thuc_hien < ?"
                + " AND hanh_dong IN ("
                + String.join(", ", Collections.nCopies(duocDon.size(), "?")) + ") LIMIT ?";
        Object[] thamSo = new Object[duocDon.size() + 2];
        thamSo[0] = threshold;
        for (int i = 0; i < duocDon.size(); i++) thamSo[i + 1] = duocDon.get(i);
        thamSo[thamSo.length - 1] = batchSize;

        try {
            while (true) {
                // Xóa từng đợt 5,000 dòng quét mã / đồng bộ sàn cũ hơn 90 ngày
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

