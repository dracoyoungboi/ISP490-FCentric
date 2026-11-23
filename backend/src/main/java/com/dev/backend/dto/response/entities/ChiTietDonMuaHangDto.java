package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * DTO for {@link com.dev.backend.entities.ChiTietDonMuaHang}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class ChiTietDonMuaHangDto implements Serializable {
    Integer id;
    BienTheSanPhamDto bienTheSanPham;
    BigDecimal soLuongDat;
    BigDecimal soLuongDaNhan;
    /** Đã nhận gồm cả hàng lỗi đã chốt trừ tiền (số này); hàng đạt = đã nhận − trừ tiền. Chỉ có ở API chi tiết đơn. */
    BigDecimal soLuongTruTien;
    BigDecimal donGia;
    BigDecimal thanhTien;
    String ghiChu;
}