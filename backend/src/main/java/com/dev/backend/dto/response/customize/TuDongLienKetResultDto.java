package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TuDongLienKetResultDto {
    int soDaGhep;
    int soKhongKhop;
    int soNhieuKhop;
    int soTaoMoiTrenShopify;
    int soTonKhoDaDay;
    int soAnhDaDay;
    int soThatBai;
}

