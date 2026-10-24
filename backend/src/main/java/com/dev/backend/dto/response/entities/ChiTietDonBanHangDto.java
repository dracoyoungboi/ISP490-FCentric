package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChiTietDonBanHangDto implements Serializable {
    Integer id;
    Integer bienTheSanPhamId;
    String sku;
    String tenSanPham;
    /** Đơn vị tính của sản phẩm (in cột ĐVT trên hóa đơn). */
    String donViTinh;
    BigDecimal soLuongDat;
    BigDecimal soLuongDaGiao;
    BigDecimal donGia;
    BigDecimal thanhTien;
    String ghiChu;
    // tenSanPham giữ dạng "Tên / Màu / Cỡ" cho hóa đơn; các trường dưới cho bảng hàng (gom, chấm màu, ảnh)
    String tenSanPhamGoc;
    Integer sanPhamId;
    String tenMau;
    String maMauHex;
    String kichCo;
    String anh;
}
