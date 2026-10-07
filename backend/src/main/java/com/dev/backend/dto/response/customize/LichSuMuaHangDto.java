package com.dev.backend.dto.response.customize;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class LichSuMuaHangDto {
    private String maDonHang;
    private Instant ngay;
    private String kenh;
    private BigDecimal giaTri;
}