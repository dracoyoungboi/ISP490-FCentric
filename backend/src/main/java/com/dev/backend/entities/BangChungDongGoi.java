package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "bang_chung_dong_goi")
public class BangChungDongGoi {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "don_ban_hang_id", nullable = false)
    DonBanHang donBanHang;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phieu_xuat_kho_id")
    PhieuXuatKho phieuXuatKho;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pick_list_id")
    DanhSachNhatHang danhSachNhatHang;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tep_tin_id", nullable = false)
    TepTin tepTin;

    @NotNull
    @Size(max = 50)
    @Column(name = "loai_bang_chung", nullable = false, length = 50)
    String loaiBangChung;

    @NotNull
    @Size(max = 20)
    @Column(name = "loai_tep", nullable = false, length = 20)
    String loaiTep;

    @Column(name = "thoi_luong_giay")
    Integer thoiLuongGiay;

    @Column(name = "kich_thuoc_bytes")
    Long kichThuocBytes;

    @NotNull
    @Size(max = 1000)
    @Column(name = "duong_dan_minio", nullable = false, length = 1000)
    String duongDanMinio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_tao_id")
    NguoiDung nguoiTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao", nullable = false)
    Instant ngayTao;

    @Column(name = "ngay_het_han", nullable = false)
    Instant ngayHetHan;

    @ColumnDefault("1")
    @Column(name = "trang_thai", nullable = false)
    Integer trangThai;

    @Size(max = 500)
    @Column(name = "ghi_chu", length = 500)
    String ghiChu;
}
