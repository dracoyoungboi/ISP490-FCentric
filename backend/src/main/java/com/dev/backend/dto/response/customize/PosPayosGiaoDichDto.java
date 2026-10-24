package com.dev.backend.dto.response.customize;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Một giao dịch chuyển khoản tại quầy cho màn quản lý "Chuyển khoản tại quầy". */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PosPayosGiaoDichDto {
    Long orderCode;
    String trangThai;
    Integer khoId;
    String tenKho;
    Integer nguoiThuNganId;
    String tenThuNgan;
    BigDecimal soTien;
    BigDecimal soTienDaNhan;
    String noiDungCk;
    String maGiaoDichNganHang;
    String errorMessage;
    /**
     * Vì sao chưa có đơn (để giao diện kể bằng lời): CHUA_RO_SO_TIEN, CHUYEN_THIEU, CHUYEN_DU, TIEN_VE_MUON (tiền
     * về khi mã QR đã hết hạn/bị hủy), LOI_TAO_DON (tiền đủ nhưng tạo đơn lỗi). Null với giao dịch bình thường.
     */
    String lyDo;
    /** Tiền về khi mã QR đã bị hủy/hết hạn: món hàng có thể đã bán bằng cách khác — bắt hỏi quầy trước khi bán. */
    boolean tienVeSauHuy;
    String tenNguoiChuyen;
    String nganHangNguoiChuyen;
    String soTkNguoiChuyen;
    /** Hàng của giao dịch còn đang giữ chỗ trong kho. */
    boolean dangGiuCho;
    Instant ngayTao;
    Instant hetHanLuc;
    Instant thanhToanLuc;
    Integer donBanHangId;
    String soDonHang;
    String tenNguoiXuLy;
    Instant xuLyLuc;
    String ghiChuXuLy;
    List<Dong> items;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Dong {
        Integer bienTheSanPhamId;
        String tenSanPham;
        BigDecimal soLuong;
        BigDecimal donGia;
    }
}
