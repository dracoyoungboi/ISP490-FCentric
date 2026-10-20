package com.dev.backend.dto.response.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MaVachNhaCungCapDto {
    Integer id;
    String maVach;
    String maHangNcc;
    Integer nhaCungCapId;
    String tenNhaCungCap;
    Integer bienTheSanPhamId;
    String tenBienThe;
    String sku;
    Instant ngayLienKet;
    Integer phieuNhapKhoId;
    String soPhieuNhap;
    String mauSac;
    String kichCo;
    String tenNguoiLienKet;
}

