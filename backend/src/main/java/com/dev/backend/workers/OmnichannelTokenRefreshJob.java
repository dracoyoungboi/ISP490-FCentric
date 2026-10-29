package com.dev.backend.workers;

import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.impl.entities.DongBoNgayService;
import jakarta.persistence.EntityManagerFactory;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * JOB-04: Tự động kiểm tra hạn ủy quyền token của các kênh bán hàng (Lazada, TikTok Shop).
 * Nếu token còn dưới 7 ngày hiệu lực, tự động gọi API làm mới token để việc đồng bộ không bị gián đoạn.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class OmnichannelTokenRefreshJob {

    KenhBanHangRepository kenhBanHangRepository;
    KenhBanHangService kenhBanHangService;
    EntityManagerFactory entityManagerFactory;

    @Scheduled(fixedDelay = 43_200_000, initialDelay = 60_000)
    public void kiemTraVaLamMoiToken() {
        DongBoNgayService.chayTrongPhienJpa(entityManagerFactory, () -> {
            Instant sapHetHan = Instant.now().plus(Duration.ofDays(7));
            List<KenhBanHang> dsKenh = kenhBanHangRepository.findByTrangThai(1);
            for (KenhBanHang kenh : dsKenh) {
                if (kenh.getTokenExpiresAt() == null) continue;
                if (kenh.getTokenExpiresAt().isBefore(sapHetHan)) {
                    log.info("[TOKEN-REFRESH] Kênh {} sắp hết hạn ủy quyền (hạn: {}), tự động kích hoạt làm mới token...",
                            kenh.getMaKenh(), kenh.getTokenExpiresAt());
                    if ("TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
                        boolean ok = kenhBanHangService.refreshTikTokAccessToken();
                        if (ok) {
                            log.info("[TOKEN-REFRESH] Làm mới token TikTok Shop tự động thành công!");
                        } else {
                            log.warn("[TOKEN-REFRESH] Không thể tự động làm mới token TikTok Shop, cần người dùng ủy quyền lại trên Seller Center!");
                        }
                    } else if ("LAZADA".equalsIgnoreCase(kenh.getMaKenh())) {
                        boolean ok = kenhBanHangService.refreshLazadaAccessToken();
                        if (ok) {
                            log.info("[TOKEN-REFRESH] Làm mới token Lazada tự động thành công!");
                        } else {
                            log.warn("[TOKEN-REFRESH] Không thể tự động làm mới token Lazada, cần người dùng ủy quyền lại!");
                        }
                    }
                }
            }
        });
    }
}
