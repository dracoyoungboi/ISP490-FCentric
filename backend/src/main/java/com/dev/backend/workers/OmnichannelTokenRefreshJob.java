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
    /** Báo quản trị viên khi làm mới thất bại lúc ủy quyền sắp hết; null khi test dựng tay. */
    @NonFinal
    @Autowired(required = false)
    ThongBaoHeThongService thongBaoHeThongService;

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
                            baoLamMoiThatBai(kenh);
                        }
                    } else if ("LAZADA".equalsIgnoreCase(kenh.getMaKenh()) || "LAZADA_SANDBOX".equalsIgnoreCase(kenh.getMaKenh())) {
                        boolean ok = kenhBanHangService.refreshLazadaAccessToken(kenh.getMaKenh());
                        if (ok) {
                            log.info("[TOKEN-REFRESH] Làm mới token {} tự động thành công!", kenh.getMaKenh());
                        } else {
                            log.warn("[TOKEN-REFRESH] Không thể tự động làm mới token {}, cần người dùng ủy quyền lại!", kenh.getMaKenh());
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
