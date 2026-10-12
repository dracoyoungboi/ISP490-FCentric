package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChiTietTonKhoKhaDungDto {
    Integer bienTheId;
    String maSku;
    String tenSanPham;
    String tenBienThe;
    BigDecimal soLuongDat;
    BigDecimal tonKhaDung;
    Boolean duHang;
}

