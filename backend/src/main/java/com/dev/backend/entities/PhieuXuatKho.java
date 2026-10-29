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

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phieu_xuat_kho")
public class PhieuXuatKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "so_phieu_xuat", nullable = false, length = 50)
    String soPhieuXuat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "don_ban_hang_id")
    DonBanHang donBanHang;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_id", nullable = false)
    Kho kho;

    @Column(name = "ngay_xuat", nullable = true)
    Instant ngayXuat;

    @Column(name = "loai_xuat")
    @Builder.Default
    String loaiXuat = "ban_hang";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kho_chuyen_den_id")
    Kho khoChuyenDen;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @Column(name = "ghi_chu")
    String ghiChu;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_xuat_id")
    NguoiDung nguoiXuat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_duyet_id")
    NguoiDung nguoiDuyet;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

    /** Phiếu chuyển kho của phiếu xuất con PX-CK (loai_xuat = chuyen_kho). Cột parent_id cũ không còn dùng. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phieu_chuyen_kho_id")
    PhieuChuyenKho phieuChuyenKho;
}