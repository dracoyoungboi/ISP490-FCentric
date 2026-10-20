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

/**
 * Hàng không đạt của một lô khi kiểm đếm nhập hàng, tách theo lý do.
 * Tổng {@code soLuong} các dòng của một lô = {@code lo_hang.so_luong_loi}.
 * Biên bản trả hàng nhà cung cấp lấy dòng từ bảng này, không lấy từ trình duyệt.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_loi_lo_hang")
public class ChiTietLoiLoHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lo_hang_id", nullable = false)
    LoHang loHang;

    @Size(max = 50)
    @NotNull
    @Column(name = "ly_do", nullable = false, length = 50)
    String lyDo;

    @NotNull
    @Column(name = "so_luong", nullable = false)
    Integer soLuong;

    @Size(max = 255)
    @Column(name = "ghi_chu", length = 255)
    String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;
}
