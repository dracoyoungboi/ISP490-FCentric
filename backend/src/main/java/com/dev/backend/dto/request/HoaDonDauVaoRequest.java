package com.dev.backend.dto.request;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Hóa đơn nhà cung cấp của phiếu nhập. coHoaDon = false: chỉ cần trường này, các trường khác bỏ qua. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HoaDonDauVaoRequest {
    private Boolean coHoaDon;
    private String mauSo;
    private String kyHieu;
    private String soHoaDon;
    private LocalDate ngayHoaDon;
    private BigDecimal thueSuat;
}
