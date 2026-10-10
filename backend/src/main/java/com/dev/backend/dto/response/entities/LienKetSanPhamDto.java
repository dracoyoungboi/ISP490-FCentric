package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LienKetSanPhamDto {
    Integer id;
    String skuSan;
    String tenSanPhamSan;
    String tenBienTheSan;
    BigDecimal giaBanSan;
    Integer bienTheSanPhamId;
    String maSku;
    String tenSanPham;
    String tenBienThe;
    BigDecimal giaBan;
    BigDecimal soLuongKhaDung;
    BigDecimal soLuongDaDay;
    Boolean choPhepDongBo;
    String trangThaiLienKet; // "da_lien_ket", "chua_lien_ket", "that_bai"
    Instant ngayDongBoCuoi;
    String chiTietLoi;
}

