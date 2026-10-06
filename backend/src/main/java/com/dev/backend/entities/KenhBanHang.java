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
@Table(name = "kenh_ban_hang")
public class KenhBanHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_kenh", nullable = false, unique = true, length = 50)
    String maKenh;

    @Size(max = 100)
    @NotNull
    @Column(name = "ten_kenh", nullable = false, length = 100)
    String tenKenh;

    @ColumnDefault("'online'")
    @Column(name = "loai_kenh", length = 20)
    @Builder.Default
    String loaiKenh = "online";

    @Size(max = 255)
    @Column(name = "api_url")
    String apiUrl;

    @Size(max = 255)
    @Column(name = "api_key")
    String apiKey;

    @Size(max = 255)
    @Column(name = "api_secret")
    String apiSecret;

    @ColumnDefault("1")
    @Column(name = "trang_thai")
    @Builder.Default
    Integer trangThai = 1;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}

