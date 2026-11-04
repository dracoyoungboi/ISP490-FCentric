package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Một lô có thể phân bổ cho dòng phiếu nhặt, sắp theo FIFO. {@code conLai} đã trừ phần phiếu nhặt / phiếu xuất
 * khác đang giữ nhưng KHÔNG trừ phần của chính dòng này ({@code daPhanBo}).
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LoKhaDungNhatHangDto {
    Integer loHangId;
    String maLo;
    Instant ngayNhapGanNhat;
    BigDecimal conLai;
    BigDecimal daPhanBo;
    /** Kệ của lô ở kho với phần còn lấy được (đã trừ phiếu nhặt khác), kệ của lô trước. */
    java.util.List<KeNhatDto> ke;
    /** Phần của chính dòng này trên từng kệ (phân bổ hiện tại). */
    java.util.List<KeNhatDto> keDaChon;
    /** Hàng chưa có kệ của lô ở kho (tồn lô − tổng sổ kệ), để kiểm phần chọn lấy ở hàng chưa có kệ. Null: chưa chia kệ. */
    Integer chuaCoKe;
}
