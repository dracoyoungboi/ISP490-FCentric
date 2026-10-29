package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phieu_nhap_kho")
public class PhieuNhapKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "so_phieu_nhap", nullable = false, length = 50)
    String soPhieuNhap;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "don_mua_hang_id")
    DonMuaHang donMuaHang;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "nha_cung_cap_id", nullable = true)
    NhaCungCap nhaCungCap;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_id", nullable = false)
    Kho kho;

    @Column(name = "ngay_nhap", nullable = true)
    Instant ngayNhap;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @ColumnDefault("0.00")
    @Column(name = "tong_tien", precision = 15, scale = 2)
    BigDecimal tongTien;

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_nhap_id")
    NguoiDung nguoiNhap;

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

    @OneToMany(mappedBy = "phieuNhapKho", fetch = FetchType.LAZY)
    List<ChiTietPhieuNhapKho> chiTietPhieuNhapKhos;

    /** Phiếu chuyển kho của phiếu nhập PN-TRF (kho đích) hoặc PN-RET (nhập hoàn trả về kho nguồn). Cột phieu_chuyen_id cũ không còn dùng. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phieu_chuyen_kho_id")
    PhieuChuyenKho phieuChuyenKho;
}