package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;
import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhieuNhapKhoItemDto {
    Integer bienTheSanPhamId;
    String sku;
    String tenBienThe;
    BigDecimal soLuongCanNhap;   // kế hoạch nhập đợt này
    BigDecimal soLuongDaKhaiBao;    // đã khai báo lô (số lượng Đạt)
    Integer soLuongDatQc;
    Integer soLuongLoiQc;
    Integer soLoDaKhoa;
    String trangThaiKiemDem; // "CHO_KIEM_DEM", "DANG_KIEM_DEM", "DA_HOAN_TAT"
    Boolean daDuLo;
    String mauSac;
    String kichCo;
    /** Mã vạch in trên tem FCentric của biến thể (có thể trống). */
    String maVachSku;
    /** Mã vạch NCC đã liên kết với biến thể này, theo nhà cung cấp của phiếu (để quét không phải gọi máy chủ). */
    List<String> maVachNcc;
}
