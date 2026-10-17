package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "bien_ban_tra_hang_ncc")
public class BienBanTraHangNcc {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_bien_ban", nullable = false, length = 50, unique = true)
    String maBienBan;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "phieu_nhap_kho_id", nullable = false)
    PhieuNhapKho phieuNhapKho;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nha_cung_cap_id", nullable = false)
    NhaCungCap nhaCungCap;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nguoi_tao_id", nullable = false)
    NguoiDung nguoiTao;

    @ColumnDefault("0")
    @Column(name = "tong_so_luong_loi", nullable = false)
    @Builder.Default
    Integer tongSoLuongLoi = 0;

    @Size(max = 50)
    @Column(name = "phuong_an_xu_ly", length = 50)
    @Builder.Default
    String phuongAnXuLy = "DOI_HANG_MOI";

    @Size(max = 50)
    @Column(name = "trang_thai", length = 50)
    @Builder.Default
    String trangThai = "CHO_TRA_HANG";

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @OneToMany(mappedBy = "bienBanTraHangNcc", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    List<ChiTietTraHangNcc> chiTiets;
}

