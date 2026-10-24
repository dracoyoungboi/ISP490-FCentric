package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

/** Đổi giá bán một hoặc nhiều biến thể trong một giao dịch (PATCH /san-pham-quan-ao/sku/gia-ban). Không có giá vốn. */
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class DoiGiaBanRequest {
    List<Dong> items;
    /** Bắt buộc, tối đa 255 ký tự; ghi vào lich_su_thay_doi.ghi_chu. */
    String lyDo;

    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static class Dong {
        Integer bienTheId;
        BigDecimal giaBan;
    }
}
