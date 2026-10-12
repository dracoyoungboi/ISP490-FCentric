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

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "kho")
public class Kho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_kho", nullable = false, length = 50)
    String maKho;

    @Size(max = 100)
    @NotNull
    @Column(name = "ten_kho", nullable = false, length = 100)
    String tenKho;

    /** kho_tong: Kho tổng phân phối hàng; cua_hang: kho bán hàng. */
    @Size(max = 20)
    @Column(name = "loai_kho", length = 20)
    String loaiKho;

    @Column(name = "dia_chi")
    String diaChi;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quan_ly_id")
    NguoiDung quanLy;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;


}