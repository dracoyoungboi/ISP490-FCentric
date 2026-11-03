package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Khóa mịn theo cặp kệ–lô của đợt kiểm kê theo danh mục, kể cả lô phát sinh chưa có dòng tồn ở kệ. Cột sinh khoa_active
 * (UNIQUE với kệ + lô) không ánh xạ: CSDL tự chặn hai đợt cùng khóa một cặp kệ–lô.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "dot_kiem_ke_khoa_lo")
public class DotKiemKeKhoaLo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "dot_kiem_ke_id", nullable = false)
    Integer dotKiemKeId;

    @Column(name = "vi_tri_kho_id", nullable = false)
    Integer viTriKhoId;

    @Column(name = "lo_hang_id", nullable = false)
    Integer loHangId;

    @Column(name = "trang_thai_khoa", nullable = false)
    @Builder.Default
    Integer trangThaiKhoa = 1;

    @Column(name = "thoi_diem_khoa", nullable = false)
    Instant thoiDiemKhoa;

    @Column(name = "thoi_diem_mo_khoa")
    Instant thoiDiemMoKhoa;

    @Column(name = "nguoi_mo_khoa_id")
    Integer nguoiMoKhoaId;
}
