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
import java.time.LocalDate;

/**
 * Phiếu chuyển kho nội bộ (bảng phieu_chuyen_kho, SDS của BA): yêu cầu, lệnh điều động, thông tin vận chuyển và số
 * phiếu XKNB. Phiếu xuất con (PX-CK) và phiếu nhập (PN-TRF / PN-RET) nối về qua cột phieu_chuyen_kho_id.
 * Trạng thái: xem IChuyenKho.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phieu_chuyen_kho")
public class PhieuChuyenKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "so_phieu_chuyen", nullable = false, length = 50)
    String soPhieuChuyen;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_xuat_id", nullable = false)
    Kho khoXuat;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_nhap_id", nullable = false)
    Kho khoNhap;

    @Column(name = "trang_thai")
    String trangThai;

    // Lệnh điều động nội bộ
    @Column(name = "so_lenh_dieu_dong", length = 50)
    String soLenhDieuDong;

    @Column(name = "ngay_lenh_dieu_dong")
    Instant ngayLenhDieuDong;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_ra_lenh_id")
    NguoiDung nguoiRaLenh;

    @Column(name = "ly_do_dieu_dong", length = 100)
    String lyDoDieuDong;

    @Column(name = "ghi_chu_lenh")
    String ghiChuLenh;

    // Người vận chuyển và phương tiện
    @Column(name = "hinh_thuc_van_chuyen")
    String hinhThucVanChuyen;

    @Column(name = "nguoi_van_chuyen", length = 100)
    String nguoiVanChuyen;

    @Column(name = "so_dien_thoai_van_chuyen", length = 20)
    String soDienThoaiVanChuyen;

    @Column(name = "loai_phuong_tien", length = 50)
    String loaiPhuongTien;

    @Column(name = "bien_so_xe", length = 20)
    String bienSoXe;

    @Column(name = "don_vi_van_chuyen", length = 150)
    String donViVanChuyen;

    @Column(name = "ma_van_don_hop_dong", length = 50)
    String maVanDonHopDong;

    @Column(name = "ngay_du_kien_den")
    Instant ngayDuKienDen;

    @Column(name = "ngay_thuc_te_den")
    Instant ngayThucTeDen;

    // Giấy đi đường: phiếu xuất kho kiêm vận chuyển nội bộ (Mẫu 03/XKNB)
    @Column(name = "ky_hieu_xknb", length = 20)
    String kyHieuXknb;

    @Column(name = "so_phieu_xknb", length = 20)
    String soPhieuXknb;

    @Column(name = "ngay_lap_xknb")
    LocalDate ngayLapXknb;

    @Column(name = "ma_tra_cuu_xknb", length = 100)
    String maTraCuuXknb;

    /** Phiếu chuyển gốc khi đây là phiếu giao bù. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phieu_goc_id")
    PhieuChuyenKho phieuGoc;

    @Column(name = "ghi_chu")
    String ghiChu;

    /** Trống với phiếu tạo trước khi nâng cấp (dữ liệu cũ không lưu người tạo). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_tao_id")
    NguoiDung nguoiTao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_huy_id")
    NguoiDung nguoiHuy;

    @Column(name = "ly_do_huy")
    String lyDoHuy;

    @Column(name = "ngay_huy")
    Instant ngayHuy;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}
