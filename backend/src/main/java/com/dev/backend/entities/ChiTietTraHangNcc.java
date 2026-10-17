package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_tra_hang_ncc")
public class ChiTietTraHangNcc {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_ban_tra_hang_ncc_id", nullable = false)
    BienBanTraHangNcc bienBanTraHangNcc;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lo_hang_id")
    LoHang loHang;

    @Size(max = 50)
    @Column(name = "ma_lo", length = 50)
    String maLo;

    @NotNull
    @Column(name = "so_luong_loi", nullable = false)
    Integer soLuongLoi;

    @Size(max = 50)
    @NotNull
    @Column(name = "ly_do_loi", nullable = false, length = 50)
    String lyDoLoi;

    @Size(max = 500)
    @Column(name = "anh_bang_chung_url", length = 500)
    String anhBangChungUrl;

    @Size(max = 255)
    @Column(name = "ghi_chu", length = 255)
    String ghiChu;
}

