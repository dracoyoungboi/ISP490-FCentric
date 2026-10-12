package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ScanToPackResultDto {
    Integer phieuXuatKhoId;
    String soPhieuXuat;
    Integer donBanHangId;
    String soDonHang;
    String maDonHangKenh;
    String tenKhachHang;
    String diaChiGiaoHang;
    String soDienThoai;
    Integer trangThaiPhieu;
    Integer trangThaiDonHang;
    boolean biHuy;
    String thongBaoCanhBao;
    List<ItemPackDto> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ItemPackDto {
        Integer bienTheId;
        String maSku;
        String tenSanPham;
        String tenMau;
        String tenSize;
        BigDecimal soLuong;
    }
}

