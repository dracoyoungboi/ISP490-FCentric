package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

/**
 * Phản hồi có cấu trúc khi không đủ tồn khả dụng (HTTP 409): liệt kê MỌI dòng thiếu
 * để màn POS đánh dấu đúng dòng giỏ và số còn lại.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PosInsufficientStockInfo {
    List<PosInsufficientItem> insufficient;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PosInsufficientItem {
        Integer bienTheSanPhamId;
        String maSku;
        BigDecimal canBan;
        BigDecimal conLai;
    }
}
