package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DonChoXuatDto implements Serializable {
    Integer id;
    String soDonHang;
    Integer kenhBanId;
    String maKenhBan;
    String tenKenhBan;
    Integer khachHangId;
    String tenKhachHang;
    Integer khoXuatId;
    String tenKhoXuat;
    Instant ngayTao;
    Integer soLuongSku;
    BigDecimal tongSoLuong;
    String khaDung;         // "Đủ hàng" (xanh lá) hoặc "Thiếu hàng" (cam) theo SRS 6.1.1
    Boolean duHang;          // Flag boolean hỗ trợ FE xử lý logic và hiển thị badge
    String trangThai;       // Mặc định "Chờ nhặt" trên màn hình Pending Order Aggregation
    BigDecimal tongCong;    // Tổng giá trị đơn
}

