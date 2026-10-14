package com.dev.backend.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Chạy việc có tác dụng ra ngoài (gọi API sàn, gửi WebSocket) SAU KHI giao dịch commit thành công,
 * để giao dịch rollback thì sàn / màn hình không nhận tin sai. Không có giao dịch thì chạy ngay.
 * Lỗi của việc chạy sau commit chỉ ghi log: dữ liệu đã commit, không được biến thành lỗi 500 cho người dùng.
 */
public final class SauCommit {

    private static final Logger log = LoggerFactory.getLogger(SauCommit.class);

    private SauCommit() {
    }

    public static void chay(String moTa, Runnable viec) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    chayAnToan(moTa, viec);
                }
            });
        } else {
            chayAnToan(moTa, viec);
        }
    }

    private static void chayAnToan(String moTa, Runnable viec) {
        try {
            viec.run();
        } catch (RuntimeException e) {
            log.warn("[SAU-COMMIT] {} thất bại: {}", moTa, e.getMessage());
        }
    }
}
