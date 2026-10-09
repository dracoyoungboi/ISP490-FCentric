package com.dev.backend.event;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DonHangXuatKhoEvent {
    Integer donBanHangId;
    String soDonHang;
    Integer kenhBanId;
    String maDonHangKenh;
    String donViVanChuyen;
    String maVanDon;
    BigDecimal phiVanChuyenThucTe;
}

