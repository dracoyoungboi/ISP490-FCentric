// src/main/java/com/dev/backend/entities/DotKiemKe.java
package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "dot_kiem_ke")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DotKiemKe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "ma_dot_kiem_ke", length = 50)
    private String maDotKiemKe;

    @Column(name = "ten_dot_kiem_ke", length = 200)
    private String tenDotKiemKe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kho_id", nullable = false)
    private Kho kho;

    @Column(name = "loai_kiem_ke")
    @Enumerated(EnumType.STRING)
    private LoaiKiemKe loaiKiemKe;

    /** Thời điểm bắt đầu thực tế (Nháp chưa có). */
    @Column(name = "ngay_bat_dau")
    private Instant ngayBatDau;

    @Column(name = "ngay_du_kien_bat_dau")
    private Instant ngayDuKienBatDau;

    @Column(name = "ngay_ket_thuc")
    private Instant ngayKetThuc;

    @Column(name = "ngay_hoan_thanh")
    private Instant ngayHoanThanh;

    @Column(name = "trang_thai")
    private Byte trangThai; // IKiemKe: 0 Nháp, 1 Đang kiểm kê, 2 Chờ duyệt, 3 Đã duyệt, 4 Đã hủy

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_chu_tri_id")
    private NguoiDung nguoiChuTri;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_duyet_id")
    private NguoiDung nguoiDuyet;

    @Column(name = "ngay_duyet")
    private Instant ngayDuyet;

    @Column(name = "mo_ta")
    private String moTa;

    @Column(name = "ly_do")
    private String lyDo;

    @Column(name = "ghi_chu")
    private String ghiChu;

    /** Danh mục gốc của đợt theo danh mục; tập hậu duệ chốt ở dot_kiem_ke_danh_muc khi bắt đầu. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "danh_muc_id")
    private DanhMucQuanAo danhMuc;

    /** Tăng ở mỗi lần đổi nháp / đổi trạng thái; client gửi lại làm expectedVersion. */
    @Column(name = "phien_ban", nullable = false)
    @Builder.Default
    private Long phienBan = 0L;

    /** 1: đợt của luồng cũ (theo lô, không kệ); 2: đợt kiểm kê khoanh vùng. */
    @Column(name = "phien_ban_pham_vi", nullable = false)
    @Builder.Default
    private Integer phienBanPhamVi = 2;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_huy_id")
    private NguoiDung nguoiHuy;

    @Column(name = "ngay_huy")
    private Instant ngayHuy;

    @Column(name = "ly_do_huy")
    private String lyDoHuy;

    @Column(name = "ngay_tao")
    private Instant ngayTao;

    @Column(name = "ngay_cap_nhat")
    private Instant ngayCapNhat;

    public enum LoaiKiemKe {
        toan_bo, theo_danh_muc, theo_khu_vuc, theo_ke, dot_xuat
    }
}