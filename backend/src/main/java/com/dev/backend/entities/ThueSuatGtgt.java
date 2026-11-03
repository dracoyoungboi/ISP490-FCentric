package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Thuế suất GTGT có ngày hiệu lực, dùng khi xuất dữ liệu kế toán (giá bán đang gồm thuế, phải tách ra).
 * danhMuc để trống là mức chung toàn hệ thống; có danh mục thì ghi đè cho danh mục đó và các danh mục con.
 * Thuế của một dòng lấy theo ngày hạch toán của chứng từ.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "thue_suat_gtgt")
public class ThueSuatGtgt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    /** Thuế suất (%): 0, 5, 8 hoặc 10. */
    @NotNull
    @Column(name = "ty_le", nullable = false, precision = 5, scale = 2)
    BigDecimal tyLe;

    @NotNull
    @Column(name = "hieu_luc_tu", nullable = false)
    LocalDate hieuLucTu;

    /** Áp dụng đến hết ngày này; null = chưa hết hiệu lực. */
    @Column(name = "hieu_luc_den")
    LocalDate hieuLucDen;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "danh_muc_id")
    DanhMucQuanAo danhMuc;

    @Size(max = 255)
    @Column(name = "ghi_chu", length = 255)
    String ghiChu;

    @Column(name = "nguoi_cap_nhat_id")
    Integer nguoiCapNhatId;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}
