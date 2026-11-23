package com.dev.backend.services.impl.entities;

import com.dev.backend.services.BienBanTraHangService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Xét hạn nhà cung cấp trả lời biên bản trả hàng: mỗi giờ trong giờ hành chính (8:00–20:00, giờ Việt Nam) để email
 * nhắc không đi lúc nửa đêm. Mỗi biên bản xét trong giao dịch riêng: một biên bản lỗi không chặn các biên bản khác.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HanTraLoiTraHangNcc {

    private final BienBanTraHangService bienBanTraHangService;

    @Scheduled(cron = "0 0 8-20 * * *", zone = "Asia/Ho_Chi_Minh")
    public void chay() {
        Instant now = Instant.now();
        for (Integer id : bienBanTraHangService.dsChoNccTraLoi()) {
            try {
                bienBanTraHangService.xetHanTraLoi(id, now);
            } catch (RuntimeException e) {
                log.error("[RTV-HAN] Không xét được hạn trả lời biên bản id {}", id, e);
            }
        }
    }
}
