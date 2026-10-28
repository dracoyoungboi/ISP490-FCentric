package com.dev.backend.dto.response.thanhtoan;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Một phiếu thu / phiếu hoàn của đơn bán thường. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThanhToanDonBanDto {
    Long id;
    String maPhieu;
    Integer donBanHangId;
    String soDonHang;
    /** THU | HOAN */
    String loai;
    /** TIEN_MAT | CHUYEN_KHOAN */
    String phuongThuc;
    BigDecimal soTien;
    String maThamChieu;
    Integer khoId;
    String tenKho;
    Instant thoiDiemThu;
    Integer nguoiThuId;
    String tenNguoiThu;
    /** HIEU_LUC | DA_HUY */
    String trangThai;
    String lyDoHuy;
    String tenNguoiHuy;
    Instant huyLuc;
    String ghiChu;
    /** Giờ ghi phiếu thật (thoiDiemThu có thể là ngày khách chuyển, lùi về trước). */
    Instant ngayTao;
    /** Chuyển khoản: quản trị viên đã đối chiếu với sao kê lúc này (null = chưa). */
    Instant doiChieuLuc;
    String tenNguoiDoiChieu;

    /** Thanh toán của một đơn: số phải thu, đã thu và các phiếu (cũ trước). */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TheoDon {
        BigDecimal phaiThu;
        BigDecimal daThu;
        /** phaiThu − daThu khi còn thiếu, ngược lại 0. */
        BigDecimal conLai;
        /** daThu − phaiThu khi thu thừa (cần hoàn), ngược lại 0. */
        BigDecimal thuThua;
        /** Trạng thái tính từ phiếu; null = đơn cũ chưa theo dõi (chưa có phiếu nào). */
        String trangThai;
        List<ThanhToanDonBanDto> phieu;
        /** Đơn bán thường (không phải tại quầy, không phải đơn sàn): thanh toán theo phiếu ghi tay. */
        boolean donThuong;
        /** Đơn bán thường chưa hủy / chưa bị hoàn trả: được ghi nhận thu tiền (quyền theo vai trò kiểm riêng). */
        boolean choGhiThu;
    }
}
