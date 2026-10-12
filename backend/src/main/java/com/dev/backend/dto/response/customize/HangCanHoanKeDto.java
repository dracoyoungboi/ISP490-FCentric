package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO đại diện cho nhiệm vụ cất hàng hoàn kệ (Put-away Task / Return to Stock)
 * phát sinh từ các đơn hàng bị hủy trong đợt nhặt hàng hoặc tại bàn đóng gói.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class HangCanHoanKeDto {
    Integer id;
    String maNhiemVu;         // PA-20261012-001
    String soDonHang;          // SO-20261012-001 hoặc SHP-1001
    String maPickList;         // PL-20261012-001
    Integer bienTheSanPhamId;
    String maSku;
    String tenSanPham;
    String phanLoai;           // Màu / Size
    String viTriKe;            // A-01-02
    BigDecimal soLuong;        // Số lượng cần cất trả lại kệ
    String loaiNguon;          // PUT_BACK_XE_DAY (Đang nhặt) hoặc RETURN_TO_STOCK_DONG_GOI (Bàn đóng gói)
    Instant thoiGianHuy;
    String trangThai;          // CHO_CAT_KE, DA_CAT_KE
    String lyDo;
}

