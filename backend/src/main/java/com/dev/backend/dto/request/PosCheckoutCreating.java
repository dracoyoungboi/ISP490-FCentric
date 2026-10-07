package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

/**
 * Request checkout POS (tiền mặt). Server là nguồn giá/tổng — unitPriceClient chỉ
 * dùng để phát hiện giá đã đổi so với lúc người bán xem (lệch -> từ chối yêu cầu
 * xác nhận lại, không tự thu số tiền mới).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PosCheckoutCreating {
    String requestId;
    Integer khoId;
    Integer khachHangId;
    List<PosCheckoutItemCreating> items;
    PosCheckoutPaymentCreating payment;
    String note;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PosCheckoutItemCreating {
        Integer bienTheSanPhamId;
        BigDecimal quantity;
        BigDecimal unitPriceClient;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PosCheckoutPaymentCreating {
        String method;
        BigDecimal tenderedAmount;
    }
}
