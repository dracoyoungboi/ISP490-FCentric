package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
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
@Table(name = "lo_hang")
public class LoHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_lo", nullable = false, length = 50)
    String maLo;

    @Column(name = "ngay_san_xuat")
    Instant ngaySanXuat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nha_cung_cap_id")
    NhaCungCap nhaCungCap;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vi_tri_kho_id")
    ViTriKho viTriKho;

    @Column(name = "so_luong_nhap")
    @Builder.Default
    Integer soLuongNhap = 0;

    @Column(name = "so_luong_con_lai")
    @Builder.Default
    Integer soLuongConLai = 0;

    @Column(name = "so_luong_loi")
    @Builder.Default
    Integer soLuongLoi = 0;

    @Size(max = 30)
    @Column(name = "trang_thai", length = 30)
    @Builder.Default
    String trangThai = "HOAT_DONG";

    @NotNull
    @Column(name = "gia_von", nullable = false, precision = 15, scale = 2)
    BigDecimal giaVon;

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;
}