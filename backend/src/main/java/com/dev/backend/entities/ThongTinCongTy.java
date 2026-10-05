package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Hồ sơ công ty dùng chung toàn hệ thống — bảng một dòng duy nhất (id luôn = 1).
 * Dùng cho phần đầu giấy của mọi mẫu in.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "thong_tin_cong_ty")
public class ThongTinCongTy {
    @Id
    @NotNull
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 255)
    @NotNull
    @Column(name = "ten_cong_ty", nullable = false, length = 255)
    String tenCongTy;

    @Size(max = 500)
    @Column(name = "logo_duong_dan", length = 500)
    String logoDuongDan;

    @Size(max = 100)
    @Column(name = "email", length = 100)
    String email;

    @Size(max = 20)
    @Column(name = "so_dien_thoai", length = 20)
    String soDienThoai;

    @Lob
    @Column(name = "dia_chi")
    String diaChi;

    @NotNull
    @Column(name = "version", nullable = false)
    Integer version;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}
