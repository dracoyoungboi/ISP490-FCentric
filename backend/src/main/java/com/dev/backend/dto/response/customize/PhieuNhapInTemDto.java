package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/** Một phiếu nhập đã hoàn tất trong hộp "In tem theo phiếu nhập": mã, ngày, kho, nhà cung cấp, số SKU, số sản phẩm. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhieuNhapInTemDto {
    Integer id;
    String soPhieuNhap;
    Instant ngayNhap;
    String tenKho;
    /** null với phiếu chuyển kho / hoàn trả. */
    String tenNhaCungCap;
    /** Số biến thể có hàng thực nhận. */
    long soSku;
    /** Tổng số lượng thực nhận (đạt kiểm đếm). */
    BigDecimal tongSoLuong;
}
