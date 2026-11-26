package com.dev.backend.workers;

import com.dev.backend.services.impl.dss.DssReplenishmentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Tác vụ định kỳ lúc 02:00 sáng hằng ngày: trích xuất biến số động (D_avg, sigma_D, L_avg)
 * và đồng bộ điểm đặt hàng lại (ROP) vào bảng {@code canh_bao}.
 */
@Component
@Slf4j
public class DssSyncJob {

    private final DssReplenishmentService dssReplenishmentService;

    public DssSyncJob(DssReplenishmentService dssReplenishmentService) {
        this.dssReplenishmentService = dssReplenishmentService;
    }

    // Cron biểu thức: 0 giây 0 phút 2 giờ mỗi ngày theo múi giờ Việt Nam (UTC+7)
    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Ho_Chi_Minh")
    public void runNightlyDssReplenishment() {
        try {
            // Quét tổng hợp toàn bộ kho đang hoạt động và đồng bộ lại ngưỡng ROP xuống bảng canh_bao của Kho tổng
            int warehouses = dssReplenishmentService.recalculateAllActiveWarehouses();
            log.info("[DssSyncJob] Đã hoàn tất cập nhật ROP và cảnh báo DSS toàn hệ thống (tổng hợp {} kho).", warehouses);
        } catch (Exception e) {
            // Bắt lỗi để không làm văng scheduler ban đêm
            log.error("[DssSyncJob] Lỗi chạy batch DSS ban đêm: {}", e.getMessage(), e);
        }
    }
}

