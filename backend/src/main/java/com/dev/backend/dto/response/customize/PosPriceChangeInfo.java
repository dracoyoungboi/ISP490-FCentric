package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

/**
 * Phản hồi có cấu trúc khi giá hiển thị đã đổi so với giá server (HTTP 409):
 * client phải cho người bán xác nhận lại giá mới, KHÔNG tự thu số tiền mới.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PosPriceChangeInfo {
    @Builder.Default
    Boolean priceChanged = true;
    List<PosPriceChangeItem> items;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PosPriceChangeItem {
        Integer bienTheSanPhamId;
        String maSku;
        BigDecimal giaHienThi;
        BigDecimal giaMoi;
    }
}
