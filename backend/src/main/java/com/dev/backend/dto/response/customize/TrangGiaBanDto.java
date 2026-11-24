package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Một trang của màn "Tem mã vạch": sản phẩm kèm các biến thể khớp bộ lọc (phân trang theo sản phẩm, một sản phẩm
 * không bị cắt sang hai trang) và số đếm cho tab. {@link CanXuLyGia} là kết quả của GET /gia-ban/can-xu-ly.
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
    /** Số biến thể khớp bộ lọc (từ khóa + tab) trên mọi trang. */
    long tongSku;
    /** Số biến thể theo từng tab, tính trên từ khóa đang tìm (R1 của StatusTabs); null khi yêu cầu gửi kemDem = false. */
    DemTheoTab demTheoTab;

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
        /** Giá in trên tem; trống hoặc ≤ 0 thì tem của SKU này không in được. */
        BigDecimal giaBan;
        /** Giá trước lần đổi giá bán gần nhất trong 7 ngày qua; null nếu không đổi giá gần đây. */
        BigDecimal giaBanCu;
        /** Lúc đổi giá đó; null cùng lúc với {@link #giaBanCu}. */
        Instant ngayDoiGia;
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
        long doiGia;
        long chuaGia;
        long thieuMa;
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
