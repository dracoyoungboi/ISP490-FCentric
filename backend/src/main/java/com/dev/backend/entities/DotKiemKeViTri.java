package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Kệ thuộc phạm vi một đợt kiểm kê và chủ sở hữu khóa của kệ (migration-2026-11-03-kiem-ke-khoanh-vung.sql).
 * <ul>
 *   <li>{@code toan_ke}: khóa cả kệ (toàn kho / khu vực / kệ). Nháp theo kệ lưu danh sách kệ đã chọn với
 *   trang_thai_khoa = 0, chưa khóa.</li>
 *   <li>{@code theo_lo}: kệ có lô thuộc danh mục đang kiểm; khóa thật nằm ở dot_kiem_ke_khoa_lo.</li>
 * </ul>
 * Cột sinh khoa_toan_ke_active (UNIQUE với kệ) không ánh xạ: CSDL tự chặn hai đợt cùng khóa toàn một kệ.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "dot_kiem_ke_vi_tri")
public class DotKiemKeViTri {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "dot_kiem_ke_id", nullable = false)
    Integer dotKiemKeId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vi_tri_kho_id", nullable = false)
    ViTriKho viTriKho;

    @Column(name = "che_do_khoa", nullable = false)
    String cheDoKhoa;

    /** 1 = đang giữ khóa, 0 = chưa khóa (nháp) hoặc đã mở. */
    @Column(name = "trang_thai_khoa", nullable = false)
    @Builder.Default
    Integer trangThaiKhoa = 0;

    @Column(name = "trang_thai_truoc_khoa", length = 30)
    String trangThaiTruocKhoa;

    @Column(name = "thoi_diem_khoa")
    Instant thoiDiemKhoa;

    @Column(name = "thoi_diem_mo_khoa")
    Instant thoiDiemMoKhoa;

    @Column(name = "nguoi_mo_khoa_id")
    Integer nguoiMoKhoaId;

    @Column(name = "ghi_chu", length = 255)
    String ghiChu;
}
