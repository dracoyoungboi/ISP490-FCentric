package com.dev.backend.dto.response.entities;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LichSuGiaoDichKhoDto {
    private Integer id;
    private Instant ngayGiaoDich;
    private String loaiGiaoDich;
    private String loaiThamChieu;
    private Integer idThamChieu;
    private String tenSanPham;
    private String maSku;
    private String maLo;
    private Integer khoId;
    private String tenKho;
    private Integer khoChuyenDenId;
    private String tenKhoChuyenDen;
    private BigDecimal soLuong;
    private BigDecimal soLuongTruoc;
    private BigDecimal soLuongSau;
    private String nguoiDungTen;
    private String ghiChu;

    // Chỉ dòng chuyển kệ nội bộ (chuyen_ke_noi_bo): tách từ câu sổ "MV-…: kệ nguồn → kệ đích" do hệ thống tự ghi
    /** Mã phiếu chuyển kệ (MV-YYYYMMDD-XXXX). */
    private String maChungTu;
    private KeGiaoDich keNguon;
    private KeGiaoDich keDich;

    /** Kệ của một dòng chuyển kệ. Danh sách chỉ có mã; chi tiết thêm khu, dãy, hàng, tầng (tra theo mã kệ trong kho). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeGiaoDich {
        private String ma;
        private String khuVuc;
        private String dayKe;
        private String hangKe;
        private String tangKe;

        public static KeGiaoDich chiMa(String ma) {
            return new KeGiaoDich(ma, null, null, null, null);
        }
    }
}