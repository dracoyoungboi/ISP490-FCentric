package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class DanhSachNhatHangDto implements Serializable {
    Integer id;
    String maPickList;
    Integer khoXuatId;
    String tenKhoXuat;
    Integer nguoiNhatId;
    String tenNguoiNhat;
    String trangThai;
    String ghiChu;
    Instant ngayTao;
    Instant ngayHoanTat;

    Integer tongDonHang;
    Integer tongSku;
    BigDecimal tongSoLuongCanNhat;
    BigDecimal tongSoLuongDaQuet;

    List<String> danhSachMaDonHang;
    List<ChiTietNhatHangDto> chiTietNhatHangs;
}

