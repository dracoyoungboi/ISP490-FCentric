package com.dev.backend.dto.request.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MaVachLienKetRequest {
    String maVach;
    String maHangNcc;
    Integer nhaCungCapId;
    Integer bienTheSanPhamId;
    Integer phieuNhapKhoId;
    String ghiChu;
}

