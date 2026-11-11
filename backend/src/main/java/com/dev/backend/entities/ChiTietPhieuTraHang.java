package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/** Một dòng hàng khách trả: số lượng, đơn giá hoàn (giá thực trả), hiện trạng QC, kệ cất, lý do. */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_phieu_tra_hang")
public class ChiTietPhieuTraHang {
    public static final String DAT = "dat";
    public static final String LOI = "loi";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "phieu_tra_hang_id", nullable = false)
    Integer phieuTraHangId;

    @Column(name = "chi_tiet_don_ban_hang_id", nullable = false)
    Integer chiTietDonBanHangId;

    @Column(name = "bien_the_san_pham_id", nullable = false)
    Integer bienTheSanPhamId;

    @Column(name = "so_luong", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuong;

    @Column(name = "don_gia_hoan", nullable = false, precision = 15, scale = 2)
    BigDecimal donGiaHoan;

    @Column(name = "thanh_tien_hoan", nullable = false, precision = 15, scale = 2)
    BigDecimal thanhTienHoan;

    @Column(name = "tinh_trang", nullable = false, length = 10)
    String tinhTrang;

    @Column(name = "vi_tri_kho_id")
    Integer viTriKhoId;

    @Column(name = "ly_do", nullable = false, length = 30)
    String lyDo;

    @Column(name = "nhom_loi", length = 30)
    String nhomLoi;

    @Column(name = "ghi_chu", length = 255)
    String ghiChu;
}
