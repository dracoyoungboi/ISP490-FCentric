package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
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
@Table(name = "mat_bang_kho")
public class MatBangKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_id", nullable = false, unique = true)
    Kho kho;

    @ColumnDefault("20")
    @Column(name = "so_cot")
    @Builder.Default
    Integer soCot = 20;

    @ColumnDefault("20")
    @Column(name = "so_hang")
    @Builder.Default
    Integer soHang = 20;

    @NotNull
    @Lob
    @Column(name = "cau_hinh_json", nullable = false)
    String cauHinhJson;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}

