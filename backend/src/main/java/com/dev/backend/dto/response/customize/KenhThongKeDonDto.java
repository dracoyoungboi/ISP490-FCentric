package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Số liệu đơn hàng của một kênh bán trong một khoảng ngày (màn Tổng quan kênh).
 * Ngày tính theo giờ Việt Nam, theo ngày hệ thống nhận đơn (ngay_dat_hang).
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KenhThongKeDonDto {
    String maKenh;
    /** yyyy-MM-dd, tính cả hai đầu */
    String tu;
    String den;
    /** Số đơn nhận trong khoảng (kể cả đơn đã hủy) */
    long tongDon;
    /** Tổng tiền các đơn không bị hủy */
    BigDecimal doanhSo;
    /** Số đơn đã hủy trong khoảng */
    long donHuy;
    /** donHuy / tongDon × 100, làm tròn 1 chữ số; 0 nếu chưa có đơn */
    double tyLeHuy;
    /** Đủ mọi ngày trong khoảng, ngày không có đơn thì số 0 */
    List<Ngay> theoNgay;
    /** Số đơn hiện có của kênh theo trạng thái (không giới hạn ngày), dùng cho mục Việc cần xử lý */
    Map<Integer, Long> theoTrangThai;

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Ngay {
        String ngay;
        long soDon;
        BigDecimal doanhSo;
        long soHuy;
    }
}
