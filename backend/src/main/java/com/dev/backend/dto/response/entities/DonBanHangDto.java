package com.dev.backend.dto.response.entities;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO for {@link com.dev.backend.entities.DonBanHang}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class DonBanHangDto implements Serializable {
    Integer id;
    String soDonHang;
    String loaiChungTu;
    KhachHangDto khachHang;
    KhoDto khoXuat;
    Instant ngayDatHang;
    Instant ngayGiaoHang;
    Integer trangThai;
    BigDecimal tienHang;
    BigDecimal phiVanChuyen;
    BigDecimal tongCong;
    String trangThaiThanhToan;
    String diaChiGiaoHang;
    String ghiChu;
    String lyDoTuChoi;
    NguoiDungDto nguoiTao;
    NguoiDungDto nguoiDuyet;
    Instant ngayTao;
    Instant ngayCapNhat;
    /** null = đơn bán thường (tạo trên hệ thống, không qua sàn/POS). */
    KenhBanHangTomTatDto kenhBanHang;
    /** Mã đơn bên sàn (vd. #1016 của Shopify); null với đơn không từ sàn. */
    String maDonHangKenh;
}