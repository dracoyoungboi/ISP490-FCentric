package com.dev.backend.workers;

import com.dev.backend.entities.BangChungDongGoi;
import com.dev.backend.repository.BangChungDongGoiRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.entities.TepTinService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * JOB-05 (SRS 12.5): Tự động xóa vĩnh viễn tệp bằng chứng đóng gói sau 30 ngày trên MinIO.
 * Trigger: Hằng ngày lúc 3:30 AM (0 30 3 * * ?).
 * Retention period: 30 ngày.
 * Xóa vật lý trên MinIO và xóa bản ghi DB theo lô 100 tệp.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PackingProofCleanupJob {

    BangChungDongGoiRepository bangChungDongGoiRepository;
    MinioService minioService;
    TepTinService tepTinService;

    @Scheduled(cron = "0 30 3 * * ?")
    public void scheduleCleanUp() {
        cleanUpOldProofs();
    }

    public int cleanUpOldProofs() {
        Instant threshold = Instant.now().minus(30, ChronoUnit.DAYS);
        log.info("[JOB-05] Bắt đầu dọn dẹp bằng chứng đóng gói MinIO quá hạn trước {}", threshold);

        int totalDeleted = 0;
        int batchCount = 0;
        int batchSize = 100;

        try {
            while (true) {
                List<BangChungDongGoi> expiredList = bangChungDongGoiRepository
                        .findTop100ByTrangThaiAndNgayTaoBefore(1, threshold);

                if (expiredList.isEmpty()) {
                    break;
                }

                for (BangChungDongGoi bc : expiredList) {
                    try {
                        if (bc.getTepTin() != null) {
                            String objectName = bc.getTepTin().getTenLuuTru();
                            if (objectName != null && !objectName.isEmpty()) {
                                minioService.delete(objectName);
                            }
                            tepTinService.hardDeleteNoMessage(bc.getTepTin().getId());
                        }
                    } catch (Exception ex) {
                        log.warn("[JOB-05] Lỗi xóa tệp MinIO cho bằng chứng id {}: {}", bc.getId(), ex.getMessage());
                    }
                    bc.setTrangThai(0);
                    bangChungDongGoiRepository.save(bc);
                    totalDeleted++;
                }

                batchCount++;
                if (expiredList.size() < batchSize) {
                    break;
                }
            }
            log.info("[JOB-05] Đã dọn dẹp thành công {} tệp bằng chứng đóng gói qua {} đợt", totalDeleted, batchCount);
        } catch (Exception e) {
            log.error("[JOB-05] Lỗi trong tiến trình dọn dẹp bằng chứng đóng gói: {}", e.getMessage(), e);
        }

        return totalDeleted;
    }
}
