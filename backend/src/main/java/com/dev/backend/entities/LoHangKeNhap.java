package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Phần hàng đạt của một lô xếp vào một kệ khi khóa lô ở màn kiểm đếm phiếu nhập
 * (migration-2026-11-20-lo-nhieu-ke.sql).
 *
 * <p>Chỉ có dòng khi lô xếp vào từ hai kệ trở lên. Lô một kệ giữ cách cũ: {@code lo_hang.vi_tri_kho_id} và số đạt của
 * lô. Lô nhiều kệ: {@code lo_hang.vi_tri_kho_id} là kệ chính (kệ đầu tiên), tổng {@code soLuong} các dòng bằng số đạt
 * của lô. Nhập kho ghi sổ tồn kệ theo từng dòng; dòng giữ lại sau khi nhập kho. Xóa theo lô và theo kệ
 * (ON DELETE CASCADE).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "lo_hang_ke_nhap", uniqueConstraints = {
        @UniqueConstraint(name = "uk_lo_hang_ke_nhap", columnNames = {"lo_hang_id", "vi_tri_kho_id"})
})
public class LoHangKeNhap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lo_hang_id", nullable = false)
    LoHang loHang;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vi_tri_kho_id", nullable = false)
    ViTriKho viTriKho;

    @Column(name = "so_luong", nullable = false)
    Integer soLuong;
}
