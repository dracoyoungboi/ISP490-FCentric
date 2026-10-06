package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Kết quả checkout POS đã lưu (được serialize vào pos_checkout_request.result_json
 * để phục hồi sau timeout). Mọi số tiền là giá trị server tính — client không
 * được tin tổng của mình. soTienThua không phải doanh thu.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PosCheckoutResponse {
    Integer donBanHangId;
    String soDonHang;
    String soPhieuXuat;
    BigDecimal tongTienHang;
    BigDecimal tongCong;
    BigDecimal soTienThu;
    BigDecimal soTienThua;
    Instant ngayGiaoHang;
    List<PosCheckoutItemResponse> items;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PosCheckoutItemResponse {
        Integer bienTheSanPhamId;
        String maSku;
        BigDecimal soLuong;
        BigDecimal donGia;
        BigDecimal thanhTien;
        BigDecimal soLuongKhaDungSau;
    }
}
