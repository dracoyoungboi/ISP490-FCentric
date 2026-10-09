package com.dev.backend.event;

import com.dev.backend.services.KenhBanHangSyncService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DonHangXuatKhoEventListener {

    KenhBanHangSyncService kenhBanHangSyncService;

    /**
     * Lắng nghe sự kiện xuất kho sau khi transaction của cơ sở dữ liệu đã COMMIT thành công 100%.
     * Chạy bất đồng bộ (@Async) để không bao giờ làm block hay chậm luồng xử lý tại quầy kho.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleDonHangXuatKho(DonHangXuatKhoEvent event) {
        if (event == null || event.getDonBanHangId() == null) return;

        log.info("DonHangXuatKhoEventListener: Nhận sự kiện xuất kho cho đơn hàng {} (ID: {}). Kích hoạt sync...",
                event.getSoDonHang(), event.getDonBanHangId());

        kenhBanHangSyncService.pushOrderStatus(
                event.getDonBanHangId(),
                "SHIPPED",
                event.getMaVanDon(),
                event.getDonViVanChuyen()
        );
    }
}

