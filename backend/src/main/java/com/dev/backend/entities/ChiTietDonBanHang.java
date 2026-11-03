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

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_don_ban_hang")
public class ChiTietDonBanHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "don_ban_hang_id", nullable = false)
    DonBanHang donBanHang;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @NotNull
    @Column(name = "so_luong_dat", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuongDat;

    @ColumnDefault("0.000")
    @Column(name = "so_luong_da_giao", precision = 15, scale = 3)
    @Builder.Default
    BigDecimal soLuongDaGiao = BigDecimal.ZERO;

    @NotNull
    @Column(name = "don_gia", nullable = false, precision = 15, scale = 2)
    BigDecimal donGia;

    @ColumnDefault("(`so_luong_dat` * `don_gia`)")
    @Column(name = "thanh_tien", precision = 15, scale = 2)
    @Generated(event = EventType.INSERT)
    BigDecimal thanhTien;

    /** Giảm giá của dòng, tiền đã gồm thuế (đơn Shopify: tổng discount_allocations của dòng); đơn khác luôn 0. */
    @NotNull
    @ColumnDefault("0.00")
    @Column(name = "tien_giam_gia", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    BigDecimal tienGiamGia = BigDecimal.ZERO;

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;


}