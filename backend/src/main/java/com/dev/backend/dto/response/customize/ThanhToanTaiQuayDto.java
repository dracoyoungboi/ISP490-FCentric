package com.dev.backend.dto.response.customize;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Lần thu tiền tại quầy của một đơn bán (bảng pos_payment) — in trên hóa đơn bán hàng khổ nhiệt:
 * hình thức (CASH / PAYOS), tiền khách đưa, tiền thừa trả khách. Đơn không bán tại quầy: null.
 * Trả kết hợp: PAYOS kèm tienMatTruoc = phần khách trả bằng tiền mặt (soTienThu là tổng hai phần).
 */
@Data
@Builder
public class ThanhToanTaiQuayDto {
    private String phuongThuc;
    private BigDecimal soTienThu;
    private BigDecimal soTienThua;
    private BigDecimal tienMatTruoc;
    private Instant ngayThu;
}
