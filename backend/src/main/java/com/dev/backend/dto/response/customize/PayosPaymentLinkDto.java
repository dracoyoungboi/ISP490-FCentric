package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/** Trạng thái một giao dịch chuyển khoản payOS cho màn POS (QR + kết quả). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PayosPaymentLinkDto {
    Long orderCode;
    String requestId;
    String trangThai;
    BigDecimal soTien;
    String qrCode;
    String checkoutUrl;
    String bin;
    String soTaiKhoan;
    String tenTaiKhoan;
    String noiDungCk;
    Instant hetHanLuc;
    String errorMessage;
    /** Có khi trangThai = PAID: kết quả đơn hàng giống checkout tiền mặt. */
    PosCheckoutResponse result;
}
