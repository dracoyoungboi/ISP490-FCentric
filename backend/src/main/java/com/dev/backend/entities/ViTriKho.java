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
@Table(name = "vi_tri_kho", uniqueConstraints = {
        @UniqueConstraint(name = "uk_kho_vi_tri", columnNames = {"kho_id", "ma_vi_tri"})
})
public class ViTriKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_id", nullable = false)
    Kho kho;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "khu_vuc_kho_id", nullable = false)
    KhuVucKho khuVucKho;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_vi_tri", nullable = false, length = 50)
    String maViTri;

    @Size(max = 20)
    @Column(name = "day_ke", length = 20)
    String dayKe;

    @Size(max = 20)
    @Column(name = "hang_ke", length = 20)
    String hangKe;

    @Size(max = 20)
    @Column(name = "tang_ke", length = 20)
    String tangKe;

    @ColumnDefault("100")
    @Column(name = "suc_chua_toi_da")
    @Builder.Default
    Integer sucChuaToiDa = 100;

    @Size(max = 30)
    @Column(name = "trang_thai", length = 30)
    @Builder.Default
    String trangThai = "HOAT_DONG";

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;
}

