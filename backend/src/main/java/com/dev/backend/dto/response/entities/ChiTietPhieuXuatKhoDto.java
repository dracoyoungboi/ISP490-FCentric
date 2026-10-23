package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;
import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChiTietPhieuXuatKhoDto {
    Integer id;
    Integer bienTheSanPhamId;
    String sku;
    String tenBienThe;
    BigDecimal soLuongCanXuat;   // SL trên phiếu
    BigDecimal soLuongDaPick;    // tổng SL đã pick theo lô
    Boolean duSoLuong;           // dùng để hiển thị badge
    // Thông tin biến thể cho bảng hàng (HienThiBienThe): gom theo sản phẩm, chấm màu, kích cỡ, ảnh
    String tenSanPham;
    Integer sanPhamId;
    String tenMau;
    String maMauHex;
    String kichCo;
    String anh;
}

