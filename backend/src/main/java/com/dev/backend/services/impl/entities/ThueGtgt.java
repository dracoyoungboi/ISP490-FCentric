package com.dev.backend.services.impl.entities;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Thuế GTGT trên hóa đơn bán hàng (hàm thuần, không đọc DB). Giá bán đã gồm thuế: tiền thuế tách ngược từ tổng thanh
 * toán (gồm phí vận chuyển), làm tròn tới đồng. Thuế suất lấy ở ThueGtgtService (bảng thue_suat_gtgt).
 */
public final class ThueGtgt {

    private static final BigDecimal TRAM = new BigDecimal("100");

    private ThueGtgt() {
    }

    /** Tiền thuế tách ngược từ tổng đã gồm thuế: tong × ts / (100 + ts), làm tròn tới đồng. */
    public static BigDecimal tienThue(BigDecimal tongDaGomThue, BigDecimal thueSuat) {
        if (tongDaGomThue == null || thueSuat == null || thueSuat.signum() == 0) return BigDecimal.ZERO;
        return tongDaGomThue.multiply(thueSuat).divide(TRAM.add(thueSuat), 0, RoundingMode.HALF_UP);
    }
}
