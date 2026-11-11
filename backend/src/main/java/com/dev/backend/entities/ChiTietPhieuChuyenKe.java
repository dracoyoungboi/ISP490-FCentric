package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/**
 * Một dòng dịch chuyển của phiếu chuyển kệ: bộ ba [biến thể – lô – kệ] bắt buộc (BR-BIN-04), từ kệ nguồn sang một kệ
 * đích. Một lô tách cất nhiều kệ đích là nhiều dòng (BR-BIN-05).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_phieu_chuyen_ke")
public class ChiTietPhieuChuyenKe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "phieu_chuyen_ke_id", nullable = false)
    PhieuChuyenKe phieuChuyenKe;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lo_hang_id", nullable = false)
    LoHang loHang;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ke_nguon_id", nullable = false)
    ViTriKho keNguon;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ke_dich_id", nullable = false)
    ViTriKho keDich;

    @Column(name = "so_luong", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuong;
}
