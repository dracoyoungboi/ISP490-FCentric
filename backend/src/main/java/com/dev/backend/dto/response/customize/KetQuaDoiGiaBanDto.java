package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

/** Kết quả đổi giá bán: biến thể đã đổi (kèm tồn để màn hình hỏi in lại tem) và biến thể bị bỏ qua (kèm lý do). */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KetQuaDoiGiaBanDto {
    List<DaDoi> daDoi;
    List<BoQua> boQua;

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DaDoi {
        Integer id;
        BigDecimal giaBanMoi;
        BigDecimal tonKho;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class BoQua {
        Integer id;
        String lyDo;
    }
}
