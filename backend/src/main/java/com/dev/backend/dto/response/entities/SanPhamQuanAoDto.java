package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO for {@link com.dev.backend.entities.SanPhamQuanAo}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class SanPhamQuanAoDto implements Serializable {
    Integer id;
    String maSanPham;
    String tenSanPham;
    String moTa;
    String maVach;
    BigDecimal giaVonMacDinh;
    BigDecimal giaBanMacDinh;
    Integer mucTonToiThieu;
    Integer trangThai;
    NguoiDungDto nguoiTao;
    Instant ngayTao;
    Instant ngayCapNhat;
    DanhMucQuanAoDto danhMuc;
    ThuongHieuDto thuongHieu;
    List<AnhQuanAoDto> anhQuanAos;
    List<BienTheSanPhamDto> bienTheSanPhams;
}