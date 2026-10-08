package com.dev.backend.services.impl.entities;

import org.springframework.dao.PessimisticLockingFailureException;

import java.sql.SQLException;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;

/**
 * Thử lại một bước ghi POS khi lỗi chỉ do chạy đồng thời (không phải lỗi nghiệp vụ):
 * - deadlock / chờ khóa quá hạn (MySQL 1213 / 1205);
 * - trùng số chứng từ (SO.../PX... sinh bằng đếm + 1, hai giao dịch đếm cùng lúc).
 *
 * Mỗi lần thử là MỘT transaction mới (caller phải KHÔNG transactional): lần trước đã
 * rollback toàn bộ, kể cả neo requestId, nên thử lại với cùng requestId là an toàn.
 * Transaction mới có snapshot mới nên đếm số chứng từ thấy được đơn vừa commit.
 */
public final class PosConcurrencyRetry {

    /** 1 lần chạy + tối đa 2 lần thử lại. */
    public static final int MAX_ATTEMPTS = 3;

    private static final int MYSQL_DEADLOCK = 1213;
    private static final int MYSQL_LOCK_WAIT_TIMEOUT = 1205;

    // MySQL báo tên index nó gặp trước; bảng có cả index cũ (so_don_hang) lẫn uk_*.
    private static final String[] DOCUMENT_NUMBER_KEYS = {
            "don_ban_hang.so_don_hang'", "uk_don_ban_hang_so_don_hang",
            "phieu_xuat_kho.so_phieu_xuat'", "uk_phieu_xuat_kho_so_phieu"
    };

    private PosConcurrencyRetry() {
    }

    public static <T> T call(Supplier<T> action) {
        for (int attempt = 1; ; attempt++) {
            try {
                return action.get();
            } catch (RuntimeException ex) {
                if (attempt >= MAX_ATTEMPTS || !isRetryable(ex)) {
                    throw ex;
                }
                backoff(attempt);
            }
        }
    }

    public static boolean isRetryable(Throwable ex) {
        return isLockFailure(ex) || isDuplicateDocumentNumber(ex);
    }

    public static boolean isLockFailure(Throwable ex) {
        for (Throwable c = ex; c != null; c = c.getCause()) {
            if (c instanceof PessimisticLockingFailureException) return true;
            if (c instanceof SQLException sql
                    && (sql.getErrorCode() == MYSQL_DEADLOCK || sql.getErrorCode() == MYSQL_LOCK_WAIT_TIMEOUT)) {
                return true;
            }
        }
        return false;
    }

    public static boolean isDuplicateDocumentNumber(Throwable ex) {
        for (Throwable c = ex; c != null; c = c.getCause()) {
            String msg = c.getMessage();
            if (msg == null || !msg.contains("Duplicate entry")) continue;
            for (String key : DOCUMENT_NUMBER_KEYS) {
                if (msg.contains(key)) return true;
            }
        }
        return false;
    }

    private static void backoff(int attempt) {
        try {
            Thread.sleep(20L * attempt + ThreadLocalRandom.current().nextInt(30));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
