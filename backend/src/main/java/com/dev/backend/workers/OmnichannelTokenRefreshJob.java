package com.dev.backend.workers;

import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.impl.entities.DongBoNgayService;
import com.dev.backend.services.impl.entities.ThongBaoHeThongService;
import jakarta.persistence.EntityManagerFactory;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * JOB-04: Tự động kiểm tra và làm mới token ủy quyền của các kênh bán hàng (TikTok Shop, Shopee).
 * - TikTok Shop: access_token 7 ngày, tự động làm mới khi còn dưới 2 ngày.
 * - Shopee: access_token chỉ có 4 giờ (14.400s), tự động làm mới khi còn dưới 1 giờ.
 * Chạy quét định kỳ mỗi 30 phút để đảm bảo không bị gián đoạn kết nối.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class OmnichannelTokenRefreshJob {

    KenhBanHangRepository kenhBanHangRepository;
    KenhBanHangService kenhBanHangService;
    EntityManagerFactory entityManagerFactory;
    /** Báo quản trị viên khi làm mới thất bại lúc ủy quyền sắp hết; null khi test dựng tay. */
    @NonFinal
    @Autowired(required = false)
    ThongBaoHeThongService thongBaoHeThongService;

    @Scheduled(fixedDelay = 1_800_000, initialDelay = 60_000)
    public void kiemTraVaLamMoiToken() {
        DongBoNgayService.chayTrongPhienJpa(entityManagerFactory, () -> {
            Instant now = Instant.now();
            Instant tiktokSapHetHan = now.plus(Duration.ofDays(2));
            Instant shopeeSapHetHan = now.plus(Duration.ofHours(1));

            List<KenhBanHang> dsKenh = kenhBanHangRepository.findByTrangThai(1);
            for (KenhBanHang kenh : dsKenh) {
                if (kenh.getTokenExpiresAt() == null) continue;
                String maKenh = kenh.getMaKenh();

                if ("TIKTOK".equalsIgnoreCase(maKenh)) {
                    if (kenh.getTokenExpiresAt().isBefore(tiktokSapHetHan)) {
                        log.info("[TOKEN-REFRESH] Kênh TikTok Shop sắp hết hạn ủy quyền (hạn: {}), tự động kích hoạt làm mới token...",
                                kenh.getTokenExpiresAt());
                        boolean ok = kenhBanHangService.refreshTikTokAccessToken();
                        if (ok) {
                            log.info("[TOKEN-REFRESH] Làm mới token TikTok Shop tự động thành công!");
                        } else {
                            log.warn("[TOKEN-REFRESH] Không thể tự động làm mới token TikTok Shop, cần người dùng ủy quyền lại trên Seller Center!");
                            baoLamMoiThatBai(kenh);
                        }
                    }
                } else if (OmnichannelOrderSyncJob.isShopee(maKenh)) {
                    if (kenh.getTokenExpiresAt().isBefore(shopeeSapHetHan)) {
                        log.info("[TOKEN-REFRESH] Kênh {} Shopee sắp hết hạn access token (hạn: {}), tự động kích hoạt làm mới token...",
                                maKenh, kenh.getTokenExpiresAt());
                        boolean ok = kenhBanHangService.refreshShopeeAccessToken(maKenh);
                        if (ok) {
                            log.info("[TOKEN-REFRESH] Làm mới token Shopee ({}) tự động thành công!", maKenh);
                        } else {
                            log.warn("[TOKEN-REFRESH] Không thể tự động làm mới token Shopee ({}), cần người dùng ủy quyền lại!", maKenh);
                            baoLamMoiThatBai(kenh);
                        }
                    }
                }
            }
        });
    }

    /** Ủy quyền còn ≤ 48 giờ (hoặc đã hết) mà làm mới thất bại thì báo quản trị viên (ThongBaoHeThongService quyết định). */
    private void baoLamMoiThatBai(KenhBanHang kenh) {
        if (thongBaoHeThongService != null) thongBaoHeThongService.lamMoiUyQuyenThatBai(kenh);
    }
}
