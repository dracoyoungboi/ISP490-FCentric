package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "chi_tiet_phieu_dieu_chinh")
public class ChiTietPhieuDieuChinh {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "phieu_dieu_chinh_kho_id", nullable = false)
    private PhieuDieuChinhKho phieuDieuChinhKho;

    /** Dòng kiểm kê (phiếu nguồn kiểm kê); mỗi dòng gắn đúng một trong hai nguồn (chk_ctpdc_mot_nguon). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chi_tiet_kiem_ke_id")
    private ChiTietKiemKe chiTietKiemKe;

    /** Dòng biên bản giao nhận (phiếu nguồn chuyển kho). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chi_tiet_bien_ban_id")
    private ChiTietBienBanGiaoNhan chiTietBienBan;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    private BienTheSanPham bienTheSanPham;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lo_hang_id", nullable = false)
    private LoHang loHang;

    @NotNull
    @Column(name = "so_luong_dieu_chinh", nullable = false, precision = 15, scale = 3)
    private BigDecimal soLuongDieuChinh;

    @NotNull
    @Column(name = "gia_von", nullable = false, precision = 15, scale = 2)
    private BigDecimal giaVon;

    @ColumnDefault("0.00")
    @Column(name = "thanh_tien", precision = 15, scale = 2)
    private BigDecimal thanhTien;

    /** tang | giam */
    @Column(name = "loai_dieu_chinh")
    private String loaiDieuChinh;

    @Lob
    @Column(name = "ghi_chu")
    private String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao")
    private Instant ngayTao;


}