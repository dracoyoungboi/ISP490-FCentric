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
    /** Phần của mã ở kho đang thuộc đợt kiểm kê (đã trừ khỏi tonKhaDung); 0 khi không kiểm. */
    BigDecimal soLuongDangKiemKe;
}

