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
@Table(name = "thuong_hieu")
public class ThuongHieu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_thuong_hieu", nullable = false, length = 50, unique = true)
    String maThuongHieu;

    @Size(max = 100)
    @NotNull
    @Column(name = "ten_thuong_hieu", nullable = false, length = 100)
    String tenThuongHieu;

    @Lob
    @Column(name = "mo_ta")
    String moTa;

    @Size(max = 500)
    @Column(name = "logo_url", length = 500)
    String logoUrl;

    // Logo quản lý qua tep_tin (chuẩn như ảnh sản phẩm); cột logo_url cũ giữ dormant
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tep_tin_id")
    TepTin tepTin;

    @ColumnDefault("1")
    @Column(name = "trang_thai")
    Integer trangThai;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao")
    @Generated(event = EventType.INSERT)
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.UPDATE)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

}