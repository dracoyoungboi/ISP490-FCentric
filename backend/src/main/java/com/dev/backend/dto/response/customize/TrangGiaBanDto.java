package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Một trang của màn "Giá bán & tem mã vạch": sản phẩm kèm các biến thể khớp bộ lọc (phân trang theo sản phẩm,
 * một sản phẩm không bị cắt sang hai trang), số đếm cho tab và cho thanh "Cần xử lý giá".
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrangGiaBanDto {
    List<NhomGiaBan> content;
    int page;
    int size;
    /** Số sản phẩm khớp bộ lọc trên mọi trang. */
    long tongSanPham;
    /** Số biến thể khớp bộ lọc (từ khóa + tab + cần xử lý giá) trên mọi trang. */
    long tongSku;
    /** Số biến thể theo từng tab, tính trên từ khóa và bộ lọc "cần xử lý giá" đang áp dụng (R1 của StatusTabs). */
    DemTheoTab demTheoTab;
    /** Số biến thể đang hoạt động cần xử lý giá trên toàn hệ thống (không theo bộ lọc). */
    CanXuLyGia canXuLy;

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class NhomGiaBan {
        Integer sanPhamId;
        String tenSanPham;
        String maSanPham;
        /** Ảnh đại diện (ảnh chính của sản phẩm, không có thì ảnh đầu); null nếu chưa có ảnh. */
        String anh;
        /** Tổng số biến thể của sản phẩm, không phụ thuộc bộ lọc ("2/5 phân loại khớp"). */
        Integer tongPhanLoai;
        /** Từ khóa khớp tên / mã sản phẩm (trả đủ biến thể); false khi chỉ khớp SKU / mã vạch của vài biến thể. */
        boolean khopTen;
        List<BienTheGiaBan> bienThe;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class BienTheGiaBan {
        Integer id;
        String maSku;
        String maVachSku;
        MauSac mauSac;
        String kichCo;
        Integer trangThai;
        /** null với người không được xem giá vốn. */
        BigDecimal giaVon;
        BigDecimal giaBan;
        /** Tổng so_luong_ton mọi kho (hàng có thật cần dán tem, không trừ hàng đã đặt). */
        BigDecimal tonKho;
        /** Lần đổi giá bán gần nhất (lich_su_thay_doi, hành động doi_gia_ban); null nếu chưa đổi lần nào. */
        Instant ngayDoiGiaGanNhat;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class MauSac {
        String ten;
        String maHex;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DemTheoTab {
        long tatCa;
        long hoatDong;
        long ngungHoatDong;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class CanXuLyGia {
        /** Đang hoạt động, giá bán trống hoặc ≤ 0. */
        long chuaCoGia;
        /** Đang hoạt động, có giá bán nhưng thấp hơn giá vốn. */
        long duoiGiaVon;
    }
}
