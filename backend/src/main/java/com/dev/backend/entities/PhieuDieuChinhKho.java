package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "phieu_dieu_chinh_kho")
public class PhieuDieuChinhKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "so_phieu", nullable = false, length = 50)
    private String soPhieu;

    /** kiem_ke: theo đợt kiểm kê · chuyen_kho: ghi giảm chênh lệch theo biên bản giao nhận (CHECK chk_pdck_nguon). */
    @ColumnDefault("'kiem_ke'")
    @Column(name = "nguon", nullable = false)
    private String nguon;

    /** Có khi nguon = kiem_ke. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dot_kiem_ke_id")
    private DotKiemKe dotKiemKe;

    /** Có khi nguon = chuyen_kho. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phieu_chuyen_kho_id")
    private PhieuChuyenKho phieuChuyenKho;

    /** Có khi nguon = chuyen_kho; mỗi biên bản tối đa một phiếu (uk_pdck_bien_ban). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bien_ban_giao_nhan_id")
    private BienBanGiaoNhan bienBanGiaoNhan;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_id", nullable = false)
    private Kho kho;

    /** tang | giam | ca_hai */
    @ColumnDefault("'ca_hai'")
    @Column(name = "loai_dieu_chinh")
    private String loaiDieuChinh;

    @NotNull
    @Column(name = "ngay_dieu_chinh", nullable = false)
    private Instant ngayDieuChinh;

    /** 0 Nháp, 1 Đã duyệt, 2 Đã áp dụng, 3 Đã hủy. */
    @ColumnDefault("0")
    @Column(name = "trang_thai")
    private Integer trangThai;

    @ColumnDefault("0.00")
    @Column(name = "tong_gia_tri_tang", precision = 15, scale = 2)
    private BigDecimal tongGiaTriTang;

    @ColumnDefault("0.00")
    @Column(name = "tong_gia_tri_giam", precision = 15, scale = 2)
    private BigDecimal tongGiaTriGiam;

    @ColumnDefault("0.00")
    @Column(name = "gia_tri_chenh_lech_thuan", precision = 15, scale = 2)
    private BigDecimal giaTriChenhLechThuan;

    @Lob
    @Column(name = "ly_do")
    private String lyDo;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nguoi_lap_id", nullable = false)
    private NguoiDung nguoiLap;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_duyet_id")
    private NguoiDung nguoiDuyet;

    @Column(name = "ngay_duyet")
    private Instant ngayDuyet;

    @Lob
    @Column(name = "ghi_chu")
    private String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao")
    private Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_cap_nhat")
    private Instant ngayCapNhat;


}