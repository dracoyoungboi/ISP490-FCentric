package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShopifyLocationDto {
    String maKhoSan;
    String tenKhoSan;
    String loai;
    boolean macDinh;
}

