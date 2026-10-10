package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "trang_thai_dong_bo_san_pham")
public class TrangThaiDongBoSanPham {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kenh_ban_id", nullable = false)
    KenhBanHang kenhBanHang;

    @Size(max = 100)
    @Column(name = "ma_san_pham_kenh", length = 100)
    String maSanPhamKenh;

    @Column(name = "trang_thai_dong_bo")
    @Builder.Default
    String trangThaiDongBo = "chua_dong_bo";

    @Column(name = "chi_tiet_loi", columnDefinition = "TEXT")
    String chiTietLoi;

    @Column(name = "ngay_dong_bo_cuoi")
    Instant ngayDongBoCuoi;
}

