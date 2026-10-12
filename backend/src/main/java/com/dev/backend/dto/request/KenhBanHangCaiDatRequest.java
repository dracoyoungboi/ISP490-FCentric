package com.dev.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KenhBanHangCaiDatRequest {
    Integer khoId;
    String maKhoSan;
    String tenKhoSan;
    Integer khachHangMacDinhId;
    @Min(value = 1, message = "Tỷ lệ đẩy tồn tối thiểu 1%")
    @Max(value = 100, message = "Tỷ lệ đẩy tồn tối đa 100%")
    Integer tyLeDayTon;
    @Min(value = 0, message = "Tồn đệm phải >= 0")
    Integer tonDem;
    @Min(value = 0, message = "Ngưỡng về 0 phải >= 0")
    Integer nguongVe0;
    String layDonTu;
}

