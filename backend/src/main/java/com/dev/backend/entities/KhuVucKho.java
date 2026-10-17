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
@Table(name = "khu_vuc_kho")
public class KhuVucKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_id", nullable = false)
    Kho kho;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_khu_vuc", nullable = false, length = 50)
    String maKhuVuc;

    @Size(max = 100)
    @NotNull
    @Column(name = "ten_khu_vuc", nullable = false, length = 100)
    String tenKhuVuc;

    @Size(max = 50)
    @Column(name = "loai_khu", length = 50)
    @Builder.Default
    String loaiKhu = "LUU_KHO";

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @ColumnDefault("1")
    @Column(name = "trang_thai")
    @Builder.Default
    Integer trangThai = 1;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;
}

