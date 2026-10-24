// src/main/java/com/dev/backend/dto/response/entities/ChiTietKiemKeDto.java
package com.dev.backend.dto.response.entities;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChiTietKiemKeDto {
    private Integer id;
    private LoHangDto loHang;
    private BienTheSanPhamDto bienTheSanPham;  // thêm để frontend hiển thị tên SP, SKU
    private BigDecimal soLuongHeThong;          // FIX: đổi từ soLuongTonHeThong → soLuongHeThong cho khớp frontend
    private BigDecimal soLuongThucTe;
    private BigDecimal chenhLechSoLuong;
    private String loaiChenhLech;
    // Thông tin biến thể cho bảng kiểm kê (HienThiBienThe): tên sản phẩm gốc, chấm màu, kích cỡ, ảnh
    private String tenSanPham;
    private Integer sanPhamId;
    private String tenMau;
    private String maMauHex;
    private String kichCo;
    private String anh;
}