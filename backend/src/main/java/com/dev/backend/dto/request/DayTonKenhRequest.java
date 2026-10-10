package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DayTonKenhRequest {
    Integer khoId;
    @Builder.Default
    BigDecimal tyLeDayTon = BigDecimal.valueOf(100);
    @Builder.Default
    Integer tonDem = 0;
    @Builder.Default
    Integer nguongVe0 = 0;
}

