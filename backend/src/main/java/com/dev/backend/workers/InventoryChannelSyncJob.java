package com.dev.backend.workers;

import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.event.InventoryDeductedEvent;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * JOB-03 (SRS 12.3): Sync Inventory to Channels.
 * Cơ chế HYBRID:
 * 1. Batch Scheduled: Chạy mỗi 5 phút đồng bộ định kỳ cho các kênh bán active.
 * 2. Event-driven Real-time: Khi tồn kho vật lý của SKU rơi xuống < 3 units, lập tức đẩy tồn khẩn cấp chống bán âm.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class InventoryChannelSyncJob {

    KenhBanHangDongBoService kenhBanHangDongBoService;
    KenhBanHangRepository kenhBanHangRepository;

    /**
     * Trigger 1: Batch Scheduled - Chạy định kỳ mỗi 5 phút (300,000 ms)
     */
    @Scheduled(fixedDelay = 300_000, initialDelay = 120_000)
    public void scheduledInventoryBatchSync() {
        List<KenhBanHang> activeChannels = kenhBanHangRepository.findByTrangThai(1);
        if (activeChannels.isEmpty()) {
            return;
        }

        log.info("[JOB-03 Batch] Bắt đầu đợt đồng bộ tồn kho định kỳ cho {} kênh bán active", activeChannels.size());
        for (KenhBanHang kenh : activeChannels) {
            try {
                DayTonKenhRequest req = DayTonKenhRequest.builder()
                        .khoId(1)
                        .tyLeDayTon(BigDecimal.valueOf(100))
                        .tonDem(0)
                        .nguongVe0(0)
                        .build();
                var result = kenhBanHangDongBoService.dayTonKhoLenKenh(kenh.getMaKenh(), req);
                log.info("[JOB-03 Batch] Đồng bộ tồn kho định kỳ kênh {} thành công: {} SKU", kenh.getMaKenh(), result.getSoDong());
            } catch (Exception e) {
                log.warn("[JOB-03 Batch] Lỗi đồng bộ tồn kho kênh {}: {}", kenh.getMaKenh(), e.getMessage());
            }
        }
    }

    /**
     * Trigger 2: Real-time Event-driven - Bắt sự kiện khi tồn kho thực tế < 3 units
     */
    @EventListener
    public void onInventoryDeducted(InventoryDeductedEvent event) {
        if (event.getSoLuongTonConLai() != null && event.getSoLuongTonConLai().compareTo(BigDecimal.valueOf(3)) < 0) {
            log.warn("[JOB-03 Real-time] CẢNH BÁO TỒN KHO THẤP: SKU ID {} chỉ còn {} đơn vị (< 3 units). Kích hoạt đẩy tồn tức thì!",
                    event.getBienTheSanPhamId(), event.getSoLuongTonConLai());
            try {
                kenhBanHangDongBoService.dayTonKhoKhanCap(event.getBienTheSanPhamId());
            } catch (Exception e) {
                log.error("[JOB-03 Real-time] Lỗi đẩy tồn khẩn cấp SKU ID {}: {}", event.getBienTheSanPhamId(), e.getMessage());
            }
        }
    }
}

