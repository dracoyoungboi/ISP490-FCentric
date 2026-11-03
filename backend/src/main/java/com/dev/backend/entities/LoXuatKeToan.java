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
 * Một lần xuất dữ liệu kế toán: gồm mọi chứng từ chưa xuất có ngày hạch toán từ ngày mốc đến {@link #denNgay}.
 * Giữ nguyên tệp nén đã giao (kèm SHA-256) để tải lại đúng bản kế toán đã nhập.
 * Danh sách lô đọc qua truy vấn chọn cột (không kéo cột tệp) — xem LoXuatKeToanRepository.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "lo_xuat_ke_toan")
public class LoXuatKeToan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull @Size(max = 30)
    @Column(name = "so_lo", nullable = false, length = 30)
    String soLo;

    @NotNull @Size(max = 30)
    @Column(name = "ho_so", nullable = false, length = 30)
    String hoSo;

    @NotNull
    @Column(name = "den_ngay", nullable = false)
    LocalDate denNgay;

    @Column(name = "tu_ngay")
    LocalDate tuNgay;

    @NotNull
    @Column(name = "co_ton_dau_ky", nullable = false)
    Boolean coTonDauKy;

    @NotNull
    @Column(name = "so_chung_tu", nullable = false)
    Integer soChungTu;

    @NotNull
    @Column(name = "tong_truoc_thue", nullable = false, precision = 18, scale = 2)
    BigDecimal tongTruocThue;

    @NotNull
    @Column(name = "tong_thue", nullable = false, precision = 18, scale = 2)
    BigDecimal tongThue;

    @NotNull
    @Column(name = "tong_cong", nullable = false, precision = 18, scale = 2)
    BigDecimal tongCong;

    @NotNull @Size(max = 120)
    @Column(name = "ten_tep", nullable = false, length = 120)
    String tenTep;

    @NotNull
    @Lob
    @Column(name = "tep", nullable = false, columnDefinition = "longblob")
    byte[] tep;

    @NotNull
    @Column(name = "kich_thuoc", nullable = false)
    Integer kichThuoc;

    @NotNull @Size(max = 64)
    @Column(name = "ma_bam", nullable = false, length = 64)
    String maBam;

    @Size(max = 500)
    @Column(name = "ghi_chu", length = 500)
    String ghiChu;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nguoi_tao_id", nullable = false)
    NguoiDung nguoiTao;

    @Column(name = "ngay_tao")
    Instant ngayTao;
}
