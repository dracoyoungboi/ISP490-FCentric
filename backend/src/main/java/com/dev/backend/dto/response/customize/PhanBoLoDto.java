package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/** Một lô trong phân bổ của dòng phiếu nhặt (cột "Lô phân bổ" ở màn nhặt hàng). */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhanBoLoDto {
    Integer loHangId;
    String maLo;
    BigDecimal soLuong;
    /** Ngày lô nhập vào kho xuất (căn cứ FIFO). */
    Instant ngayNhapGanNhat;
}
