package com.dev.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Báo cáo doanh thu kèm cùng kỳ năm trước (màn Báo cáo doanh thu và tệp Excel dùng chung). Doanh thu tính theo ngày giao
 * hàng của đơn đã xuất / hoàn thành, giá vốn theo lô đã xuất. Kỳ này cắt tới hôm nay; cùng kỳ = cùng khoảng ngày năm trước.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DoanhThuTongHopDTO {
    /** ngay | thang | nam */
    String loai;
    LocalDate tuNgay;
    LocalDate denNgay;
    LocalDate tuNgayCungKy;
    LocalDate denNgayCungKy;
    Tong kyNay;
    Tong cungKy;
    /** Quản lý kho xem "Tất cả kho": chỉ tính các cửa hàng mình phụ trách. */
    boolean theoKhoPhuTrach;
    /** Từng kỳ theo thứ tự thời gian: theo ngày mọi ngày trong khoảng, theo tháng đủ 12 tháng, theo năm mọi năm. */
    List<Ky> theoKy;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Tong {
        BigDecimal tienHang;
        BigDecimal phiVanChuyen;
        BigDecimal doanhThu;
        BigDecimal giaVon;
        BigDecimal loiNhuan;
        long soDon;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Ky {
        /** Trùng nhãn của khối tiền thu (01/10, T10/2026, 2026). */
        String nhanThoiGian;
        int sortKey;
        /** Kỳ chưa tới (sau hôm nay): không có số, không so cùng kỳ; bảng và tệp Excel bỏ qua. */
        boolean chuaToi;
        LocalDate tuNgay;
        LocalDate denNgay;
        BigDecimal doanhThu;
        BigDecimal giaVon;
        BigDecimal loiNhuan;
        long soDon;
        BigDecimal doanhThuCungKy;
        BigDecimal giaVonCungKy;
        BigDecimal loiNhuanCungKy;
        long soDonCungKy;
    }
}
