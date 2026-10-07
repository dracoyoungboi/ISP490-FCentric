package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;

import java.math.BigDecimal;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_nhat_hang")
public class ChiTietNhatHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "danh_sach_nhat_hang_id", nullable = false)
    DanhSachNhatHang danhSachNhatHang;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @NotNull
    @Column(name = "so_luong_can_nhat", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuongCanNhat;

    @ColumnDefault("0.000")
    @Column(name = "so_luong_da_quet", precision = 15, scale = 3)
    @Builder.Default
    BigDecimal soLuongDaQuet = BigDecimal.ZERO;
}

