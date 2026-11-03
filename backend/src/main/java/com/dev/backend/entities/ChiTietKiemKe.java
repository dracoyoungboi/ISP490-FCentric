// src/main/java/com/dev/backend/entities/ChiTietKiemKe.java
package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "chi_tiet_kiem_ke")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChiTietKiemKe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "dot_kiem_ke_id")
    private Integer dotKiemKeId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    private BienTheSanPham bienTheSanPham;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lo_hang_id", nullable = false)
    private LoHang loHang;

    @Column(name = "so_luong_he_thong", precision = 15, scale = 3)
    private BigDecimal soLuongHeThong;

    @Column(name = "gia_von_he_thong", precision = 15, scale = 2)
    private BigDecimal giaVonHeThong;

    @Column(name = "so_luong_thuc_te", precision = 15, scale = 3)
    private BigDecimal soLuongThucTe;

    @Column(name = "gia_von_thuc_te", precision = 15, scale = 2)
    private BigDecimal giaVonThucTe;

    @Column(name = "chenh_lech_so_luong", precision = 15, scale = 3)
    private BigDecimal chenhLechSoLuong;

    @Column(name = "ti_le_chenh_lech", precision = 18, scale = 2)
    private BigDecimal tiLeChenhLech;

    @Column(name = "gia_tri_chenh_lech", precision = 15, scale = 2)
    private BigDecimal giaTriChenhLech;

    @Column(name = "loai_chenh_lech")
    @Enumerated(EnumType.STRING)
    private LoaiChenhLech loaiChenhLech;

    /** Mã kệ lúc chốt (chỉ để hiển thị / in; kệ thật ở viTriKe). */
    @Column(name = "vi_tri_kho", length = 200)
    private String viTriKho;

    /** Kệ của dòng; NULL ở dòng của luồng cũ (chưa biết kệ). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vi_tri_kho_id")
    private ViTriKho viTriKe;

    @Column(name = "lan_kiem_dem", nullable = false)
    @Builder.Default
    private Integer lanKiemDem = 1;

    /** Tăng ở mỗi lần lưu dòng; hai máy cùng sửa một dòng thì máy gửi phiên bản cũ nhận 409. */
    @Column(name = "phien_ban", nullable = false)
    @Builder.Default
    private Long phienBan = 0L;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_kiem_dem_id")
    private NguoiDung nguoiKiemDem;

    @Column(name = "ngay_kiem_dem")
    private Instant ngayKiemDem;

    @Column(name = "trang_thai")
    private Byte trangThai; // IKiemKe: 0 Chưa kiểm, 1 Đã kiểm, 2 Cần kiểm lại, 3 Đã xác nhận

    @Column(name = "ly_do_chenh_lech")
    private String lyDoChenhLech;

    @Column(name = "bien_phap_xu_ly")
    private String bienPhapXuLy;

    @Column(name = "ghi_chu")
    private String ghiChu;

    @Column(name = "ngay_tao")
    private Instant ngayTao;

    @Column(name = "ngay_cap_nhat")
    private Instant ngayCapNhat;

    public enum LoaiChenhLech {
        thieu, thua, khop
    }
}