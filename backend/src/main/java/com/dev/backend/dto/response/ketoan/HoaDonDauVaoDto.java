package com.dev.backend.dto.response.ketoan;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Hóa đơn nhà cung cấp của một phiếu nhập. daNhap = false: chưa nhập hóa đơn (các trường khác null).
 * daKhoa = true: phiếu đã xuất sang kế toán (soLoXuat). nhapSauXuat = true: phiếu xuất lúc chưa có hóa đơn, vẫn nhập /
 * sửa hóa đơn được (không đổi chứng từ đã xuất, chỉ để nhắc kế toán Nhận hóa đơn trên AMIS); false thì không sửa được.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HoaDonDauVaoDto {
    private Integer phieuNhapKhoId;
    private boolean daNhap;
    private Boolean coHoaDon;
    private String mauSo;
    private String kyHieu;
    private String soHoaDon;
    private LocalDate ngayHoaDon;
    private BigDecimal thueSuat;
    private boolean daKhoa;
    private boolean nhapSauXuat;
    private String soLoXuat;
    private Instant ngayCapNhat;
}
