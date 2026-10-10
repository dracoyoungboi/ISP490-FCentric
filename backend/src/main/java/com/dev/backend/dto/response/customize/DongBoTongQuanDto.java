package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DongBoTongQuanDto {
    long tongSkuSan;
    long daLienKet;
    long chuaLienKet;
    long loiDongBo;
    Instant lanDongBoCuoi;
}

