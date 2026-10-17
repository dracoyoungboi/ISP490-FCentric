package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_phieu_nhap_kho")
public class ChiTietPhieuNhapKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "phieu_nhap_kho_id", nullable = false)
    PhieuNhapKho phieuNhapKho;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lo_hang_id", nullable = true)
    LoHang loHang;

    @NotNull
    @Column(name = "so_luong_nhap", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuongNhap;

    @NotNull
    @Column(name = "don_gia", nullable = false, precision = 15, scale = 2)
    BigDecimal donGia;

    @ColumnDefault("(`so_luong_nhap` * `don_gia`)")
    @Column(name = "thanh_tien", precision = 15, scale = 2)
    @Generated(event = EventType.INSERT)
    BigDecimal thanhTien;

    @Column(name = "so_luong_yeu_cau")
    @Builder.Default
    Integer soLuongYeuCau = 0;

    @Column(name = "so_luong_dat_qc")
    @Builder.Default
    Integer soLuongDatQc = 0;

    @Column(name = "so_luong_loi_qc")
    @Builder.Default
    Integer soLuongLoiQc = 0;

    @Column(name = "trang_thai_kiem_dem", length = 30)
    @Builder.Default
    String trangThaiKiemDem = "CHO_KIEM_DEM";

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao")
    @Generated(event = EventType.INSERT)
    Instant ngayTao;
}