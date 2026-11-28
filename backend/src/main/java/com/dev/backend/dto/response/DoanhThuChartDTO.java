package com.dev.backend.dto.response;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DoanhThuChartDTO {
    String nhanThoiGian;        // Nhãn trục X: "01/01", "Tuần 1", "T1/2024", "2024"

    BigDecimal tienHang;        // Tiền hàng khách trả: tổng cộng − phí vận chuyển (còn gồm thuế GTGT), đã trừ hàng trả
    BigDecimal phiVanChuyen;    // Phí vận chuyển thu của khách (không tính doanh thu)
    BigDecimal doanhThu;        // Doanh thu = tiền hàng − thuế GTGT, đã trừ hàng trả về  → CỘT
    BigDecimal giaVon;          // Tổng giá vốn xuất kho
    BigDecimal loiNhuan;        // doanhThu - giaVon                    → ĐƯỜNG

    public DoanhThuChartDTO(String nhanThoiGian, BigDecimal tienHang, BigDecimal phiVanChuyen,
                            BigDecimal doanhThu, BigDecimal giaVon, BigDecimal loiNhuan,
                            Long soLuongDon, Integer sortKey) {
        this.nhanThoiGian = nhanThoiGian;
        this.tienHang = tienHang;
        this.phiVanChuyen = phiVanChuyen;
        this.doanhThu = doanhThu;
        this.giaVon = giaVon;
        this.loiNhuan = loiNhuan;
        this.soLuongDon = soLuongDon;
        this.sortKey = sortKey;
    }

    Long       soLuongDon;      // Số đơn hàng hoàn thành               → ĐƯỜNG PHỤ
    BigDecimal tyLeLaiGop;      // loiNhuan / doanhThu * 100

    // Thêm trường sắp xếp nội bộ (không render ra chart)
    Integer    sortKey;
}
