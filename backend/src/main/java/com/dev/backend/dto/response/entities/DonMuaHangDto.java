package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO for {@link com.dev.backend.entities.DonMuaHang}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class DonMuaHangDto implements Serializable {
    Integer id;
    String soDonMua;
    // Yêu cầu nhập hàng gốc (rút gọn). Trước đây DTO thiếu trường này nên ô "Yêu cầu mua hàng gốc" luôn trống.
    YeuCauMuaHangRutGonDto yeuCauMuaHang;
    NhaCungCapDto nhaCungCap;
    KhoDto khoNhap;
    Instant ngayDatHang;
    Instant ngayGiaoDuKien;
    Integer trangThai;
    BigDecimal tongTien;
    String ghiChu;
    NguoiDungDto nguoiTao;
    NguoiDungDto nguoiDuyet;
    Instant ngayTao;
    Instant ngayCapNhat;
    List<ChiTietDonMuaHangDto> chiTietDonMuaHangs;

}