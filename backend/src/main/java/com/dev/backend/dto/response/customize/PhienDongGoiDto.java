package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

/**
 * Phiên đóng gói (Scan-to-Pack) của một đơn bán: phiếu xuất của đơn và tiến độ quét từng dòng.
 * Trả về cho màn đóng gói sau mỗi lần tải / quét / hoàn tất.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhienDongGoiDto {
    Integer donBanHangId;
    String soDonHang;
    Integer trangThaiDon;
    String maDonHangKenh;
    String tenKenh;
    String tenKhachHang;
    String soDienThoai;
    String diaChiGiaoHang;

    Integer phieuXuatKhoId;
    String soPhieuXuat;
    Integer trangThaiPhieu;
    Integer khoId;
    String tenKho;
    String maPickList;

    BigDecimal tongSoLuongCan;
    BigDecimal tongSoLuongDaQuet;
    Double phanTramHoanThanh;
    /** Đã quét đủ mọi dòng và phiếu còn ở Nháp. */
    Boolean coTheHoanTat;
    /** Đơn đã bị hủy (thường do sàn hủy): khóa đóng gói, hàng cần cất về kệ. */
    Boolean biHuy;
    String thongBao;

    /** Dòng vừa quét (để màn hình tô sáng). */
    Integer chiTietVuaQuetId;

    BigDecimal tongTienDonHang;
    Boolean yeuCauVideo;
    String loaiYeuCau;
    Boolean daDuBangChung;
    List<BangChungDongGoiDto> danhSachBangChung;

    List<DongDongGoiDto> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongDongGoiDto {
        Integer chiTietId;
        Integer bienTheId;
        String maSku;
        String maVachSku;
        String tenSanPham;
        String tenMau;
        String tenSize;
        BigDecimal soLuongCan;
        BigDecimal soLuongDaQuet;
    }
}
