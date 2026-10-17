package com.dev.backend.dto.response.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BienBanTraHangDto {
    Integer id;
    String soBienBan;
    Integer phieuNhapKhoId;
    String soPhieuNhap;
    Integer nhaCungCapId;
    String tenNhaCungCap;
    String phuongAn;
    String ghiChu;
    Instant ngayLap;
    Integer tongSoLuongLoi;
    String trangThai;
    List<ChiTietItemDto> items;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ChiTietItemDto {
        Integer id;
        Integer bienTheSanPhamId;
        String sku;
        String tenBienThe;
        String maLo;
        String lyDo;
        Integer soLuong;
        String anhBangChungUrl;
        String ghiChu;
    }
}

