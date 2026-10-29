package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

/** Dòng hàng yêu cầu chuyển (một biến thể một dòng, số lượng nguyên). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_phieu_chuyen_kho")
public class ChiTietPhieuChuyenKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "phieu_chuyen_kho_id", nullable = false)
    PhieuChuyenKho phieuChuyenKho;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @NotNull
    @Column(name = "so_luong_chuyen", nullable = false)
    Integer soLuongChuyen;

    @Column(name = "ghi_chu")
    String ghiChu;
}
