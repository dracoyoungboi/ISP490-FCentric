package com.dev.backend.dto.response.customize;

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
public class LoHangKhaiBaoDto {
    Integer chiTietPhieuNhapKhoId; // để update / delete
    Integer loHangId;
    String maLo;
    Instant ngaySanXuat;
    BigDecimal soLuongNhap; // số lượng theo lô (Đạt)
    BigDecimal soLuongLoi;  // số lượng lỗi
    Integer viTriKhoId;
    String maViTri;
    String trangThai;
    String ghiChu;
}
