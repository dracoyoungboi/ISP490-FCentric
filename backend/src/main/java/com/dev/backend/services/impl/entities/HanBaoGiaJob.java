package com.dev.backend.services.impl.entities;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Xét hạn báo giá của các đơn còn chờ nhà cung cấp: mỗi giờ trong giờ hành chính (8:00–20:00, giờ Việt Nam) để email
 * nhắc, email hết hạn không đi lúc nửa đêm (cùng nhịp với hạn trả lời biên bản trả hàng). Đơn qua hạn lúc 0:00 được ghi
 * Hết hạn ở lượt 8:00; trong lúc đó các màn đã hiện Hết hạn theo giờ và cổng đã chặn gửi. Mỗi đơn xét trong giao dịch
 * riêng: một đơn lỗi không chặn các đơn khác.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HanBaoGiaJob {

    private final DonMuaHangService donMuaHangService;

    @Scheduled(cron = "0 0 8-20 * * *", zone = "Asia/Ho_Chi_Minh")
    public void chay() {
        Instant now = Instant.now();
        int nhac = 0, hetHan = 0;
        for (Integer id : donMuaHangService.idDonChoBaoGia()) {
            try {
                DonMuaHangService.KetQuaXetHan kq = donMuaHangService.xetHanBaoGia(id, now);
                if (kq == DonMuaHangService.KetQuaXetHan.DA_NHAC) nhac++;
                else if (kq == DonMuaHangService.KetQuaXetHan.HET_HAN) hetHan++;
            } catch (RuntimeException e) {
                log.error("[RFQ-HAN] Không xét được hạn báo giá đơn id {}", id, e);
            }
        }
        if (nhac > 0 || hetHan > 0) {
            log.info("[RFQ-HAN] Đã nhắc {} đơn, {} đơn hết hạn báo giá", nhac, hetHan);
        }
    }
}
