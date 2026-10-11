package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BienTheOptionDto {
    Integer id;
    String maSku;
    String tenBienThe;
    String tenSanPham;
    BigDecimal giaBan;
}

