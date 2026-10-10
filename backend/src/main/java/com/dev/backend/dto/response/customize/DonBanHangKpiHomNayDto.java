package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DonBanHangKpiHomNayDto {
    Long tongDonHomNay;
    Long choXuLy;
    Long dangXuLy;
    BigDecimal giaTriDonHomNay;
}

