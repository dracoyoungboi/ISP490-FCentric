package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/** Phần lô của một dòng hàng trả (lô lấy từ phiếu xuất của đơn gốc). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_phieu_tra_hang_lo")
public class ChiTietPhieuTraHangLo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "chi_tiet_phieu_tra_hang_id", nullable = false)
    Integer chiTietPhieuTraHangId;

    @Column(name = "lo_hang_id", nullable = false)
    Integer loHangId;

    @Column(name = "so_luong", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuong;

    @Column(name = "gia_von", nullable = false, precision = 15, scale = 2)
    BigDecimal giaVon;
}
