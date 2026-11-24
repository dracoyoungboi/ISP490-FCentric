package com.dev.backend.dto.response.customize;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Kho xuất của đơn đang thiếu hàng để nhặt đơn: hoặc kho đang khóa vì kiểm kê toàn kho, hoặc có dòng
 * tồn khả dụng nhỏ hơn số đặt. Màn chi tiết đơn bán hiện dải cảnh báo theo dữ liệu này; null khi kho đủ.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThieuTonKhoXuatDto {
    private Integer khoId;
    private String tenKho;
    /** Mã đợt kiểm kê toàn kho đang khóa kho xuất; null nếu không có. */
    private String dotKiemKeToanKho;
    /** Mọi biến thể thiếu (đã cộng các dòng trùng biến thể trong đơn). */
    private List<Dong> dong;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Dong {
        private Integer bienTheId;
        private String maSku;
        private BigDecimal soLuongCan;
        /** Tồn khả dụng cho đơn này tại kho xuất, không âm. */
        private BigDecimal tonKhaDung;
        private BigDecimal soLuongThieu;
    }
}
