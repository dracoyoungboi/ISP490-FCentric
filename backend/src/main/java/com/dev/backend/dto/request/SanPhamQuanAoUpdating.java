package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class SanPhamQuanAoUpdating {

    Integer id;
    String maSanPham;
    String tenSanPham;
    Integer danhMucId;
    Integer thuongHieuId;
    String moTa;
    String maVach;
    BigDecimal giaVonMacDinh;
    BigDecimal giaBanMacDinh;
    Integer mucTonToiThieu;
    Integer trangThai;
    boolean isImageUpdated;
    // true = áp dụng thay đổi thương hiệu (null thuongHieuId = gỡ liên kết); false = giữ nguyên
    boolean capNhatThuongHieu;
    List<BienTheSanPhamUpdating> bienTheSanPhams;
}
