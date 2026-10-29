package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

/** Dòng lệch của biên bản giao nhận, theo biến thể và lô (thiếu = gửi − nhận − hỏng). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_bien_ban_giao_nhan")
public class ChiTietBienBanGiaoNhan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_ban_id", nullable = false)
    BienBanGiaoNhan bienBan;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lo_hang_id", nullable = false)
    LoHang loHang;

    @Column(name = "so_luong_gui", nullable = false)
    Integer soLuongGui;

    @Column(name = "so_luong_nhan", nullable = false)
    Integer soLuongNhan;

    @Column(name = "so_luong_thieu", nullable = false)
    Integer soLuongThieu;

    @Column(name = "so_luong_hong", nullable = false)
    Integer soLuongHong;

    @Column(name = "ly_do_hong_thieu")
    String lyDoHongThieu;
}
