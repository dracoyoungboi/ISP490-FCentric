package com.dev.backend.workers;

import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.event.InventoryDeductedEvent;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.utils.KenhCauHinhDongBo;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * JOB-03 (SRS 12.3): Sync Inventory to Channels.
 * Cơ chế HYBRID ĐỘNG THEO CẤU HÌNH HỆ THỐNG:
 * 1. Batch Scheduled: Chạy định kỳ theo cấu hình OMNI_SYNC_INTERVAL_MINS (mặc định 10 phút).
 * 2. Event-driven Real-time: Khi tồn kho vật lý của SKU rơi xuống < REALTIME_SYNC_THRESHOLD (mặc định 3 đơn vị), lập tức đẩy tồn khẩn cấp chống bán âm.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class InventoryChannelSyncJob {

    KenhBanHangDongBoService kenhBanHangDongBoService;
    KenhBanHangRepository kenhBanHangRepository;
    DieuHanhHeThongService dieuHanhHeThongService;
    AtomicReference<Instant> lastSyncTime = new AtomicReference<>(Instant.EPOCH);

    /**
     * Trigger 1: Batch Scheduled - Heartbeat mỗi 60 giây, kiểm tra theo chu kỳ cấu hình OMNI_SYNC_INTERVAL_MINS
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void scheduledInventoryBatchSync() {
        int intervalMins = 10;
        if (dieuHanhHeThongService != null) {
            intervalMins = dieuHanhHeThongService.getCauHinhInt("OMNI_SYNC_INTERVAL_MINS", 10);
        }
        intervalMins = Math.max(1, Math.min(intervalMins, 1440));

        Instant last = lastSyncTime.get();
        Instant now = Instant.now();
        if (last != Instant.EPOCH && Duration.between(last, now).toMinutes() < intervalMins) {
            return;
        }

        lastSyncTime.set(now);
        List<KenhBanHang> activeChannels = kenhBanHangRepository.findByTrangThai(1);
        if (activeChannels.isEmpty()) {
            return;
        }

        log.info("[JOB-03 Batch] Bắt đầu đợt đồng bộ tồn kho định kỳ cho {} kênh bán active (Chu kỳ: {} phút)", activeChannels.size(), intervalMins);
        for (KenhBanHang kenh : activeChannels) {
            // Cấu hình theo kênh (màn Cấu hình kênh); chưa lưu thì giữ mặc định cũ: bật, 100%, tồn đệm 0, ngưỡng 0
            if (!KenhCauHinhDongBo.tuDongDayTon(dieuHanhHeThongService, kenh.getMaKenh())) {
                log.info("[JOB-03 Batch] Kênh {} đang tắt tự động đẩy tồn, bỏ qua", kenh.getMaKenh());
                continue;
            }
            try {
                DayTonKenhRequest req = DayTonKenhRequest.builder()
                        .khoId(1)
                        .tyLeDayTon(BigDecimal.valueOf(KenhCauHinhDongBo.tyLeDayTon(dieuHanhHeThongService, kenh.getMaKenh())))
                        .tonDem(KenhCauHinhDongBo.tonDem(dieuHanhHeThongService, kenh.getMaKenh()))
                        .nguongVe0(KenhCauHinhDongBo.nguongVe0(dieuHanhHeThongService, kenh.getMaKenh()))
                        .build();
                var result = kenhBanHangDongBoService.dayTonKhoLenKenh(kenh.getMaKenh(), req);
                if (result.getLoiKenh() != null) {
                    log.warn("[JOB-03 Batch] Đồng bộ tồn kho định kỳ kênh {}: {} SKU thành công, {} SKU lỗi, {} SKU chưa đẩy — {}",
                            kenh.getMaKenh(), result.getSoDong(), result.getSoLoi(), result.getSoChuaDay(), result.getLoiKenh());
                } else {
                    log.info("[JOB-03 Batch] Đồng bộ tồn kho định kỳ kênh {}: {} SKU thành công, {} SKU lỗi",
                            kenh.getMaKenh(), result.getSoDong(), result.getSoLoi());
                }
            } catch (Exception e) {
                log.warn("[JOB-03 Batch] Lỗi đồng bộ tồn kho kênh {}: {}", kenh.getMaKenh(), e.getMessage());
            }
        }
    }

    /**
     * Trigger 2: Real-time Event-driven - Bắt sự kiện khi tồn kho thực tế < REALTIME_SYNC_THRESHOLD
     */
    @EventListener
    public void onInventoryDeducted(InventoryDeductedEvent event) {
        int threshold = 3;
        if (dieuHanhHeThongService != null) {
            threshold = dieuHanhHeThongService.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3);
        }
        threshold = Math.max(0, Math.min(threshold, 100));

        if (event.getSoLuongTonConLai() != null && event.getSoLuongTonConLai().compareTo(BigDecimal.valueOf(threshold)) < 0) {
            // Đẩy tồn khẩn cấp hiện chỉ đẩy lên Shopify; tôn trọng công tắc "Tự động đẩy tồn" của kênh này
            if (!KenhCauHinhDongBo.tuDongDayTon(dieuHanhHeThongService, KenhCauHinhDongBo.MA_KENH_SHOPIFY)) {
                log.info("[JOB-03 Real-time] Kênh Shopify đang tắt tự động đẩy tồn, bỏ qua đẩy khẩn SKU ID {}", event.getBienTheSanPhamId());
                return;
            }
            log.warn("[JOB-03 Real-time] CẢNH BÁO TỒN KHO THẤP: SKU ID {} chỉ còn {} đơn vị (< {} units theo cấu hình). Kích hoạt đẩy tồn tức thì!",
                    event.getBienTheSanPhamId(), event.getSoLuongTonConLai(), threshold);
            try {
                kenhBanHangDongBoService.dayTonKhoKhanCap(event.getBienTheSanPhamId());
            } catch (Exception e) {
                log.error("[JOB-03 Real-time] Lỗi đẩy tồn khẩn cấp SKU ID {}: {}", event.getBienTheSanPhamId(), e.getMessage());
            }
        }
    }
}

