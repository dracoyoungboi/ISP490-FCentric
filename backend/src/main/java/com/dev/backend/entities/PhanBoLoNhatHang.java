package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Phân bổ lô cho một dòng phiếu nhặt (Database/phan_bo_lo_nhat_hang_v1.sql). Tổng các lô của một dòng bằng
 * số cần nhặt; khi phiếu nhặt còn mở (cho_nhat / dang_nhat) phần này giữ lô với nơi khác.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phan_bo_lo_nhat_hang")
public class PhanBoLoNhatHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "chi_tiet_nhat_hang_id", nullable = false)
    ChiTietNhatHang chiTietNhatHang;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lo_hang_id", nullable = false)
    LoHang loHang;

    @NotNull
    @Column(name = "so_luong", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuong;

    /** Người lưu gần nhất; null = hệ thống tự phân bổ theo FIFO. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_cap_nhat_id")
    NguoiDung nguoiCapNhat;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}
