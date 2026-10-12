package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KhoKhaDungDto {
    Integer khoId;
    String maKho;
    String tenKho;
    String diaChi;
    Boolean duHang;
    Integer soLuongMatHangDu;
    Integer tongSoMatHang;
    List<ChiTietTonKhoKhaDungDto> chiTietTonKho;
}

