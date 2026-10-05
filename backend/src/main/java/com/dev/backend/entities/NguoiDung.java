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
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "nguoi_dung")
public class NguoiDung {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ten_dang_nhap", nullable = false, length = 50)
    String tenDangNhap;

    @Size(max = 255)
    @NotNull
    @Column(name = "mat_khau_hash", nullable = false)
    String matKhauHash;

    @Size(max = 100)
    @NotNull
    @Column(name = "ho_ten", nullable = false, length = 100)
    String hoTen;

    @Size(max = 100)
    @Column(name = "email", length = 100)
    String email;

    @Size(max = 20)
    @Column(name = "so_dien_thoai", length = 20)
    String soDienThoai;

    @NotNull
    @Lob
    @Column(name = "vai_tro", nullable = false)
    String vaiTro;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao")
    @Generated(event = EventType.INSERT)
    Instant ngayTao;

    @Transient // Quan trọng: Trường này chỉ tồn tại ở code Java, không lưu xuống DB
    List<PhanQuyenNguoiDungKho> khoPhuTrach;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_cap_nhat")
    @Generated(event = EventType.UPDATE)
    Instant ngayCapNhat;

    @Column(name = "must_change_password", nullable = false)
    Boolean mustChangePassword = false;

    // Ảnh đại diện quản lý qua tep_tin (chuẩn như ảnh sản phẩm/logo); null = chưa có ảnh, FE hiển thị initials
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "avatar_tep_tin_id")
    TepTin avatarTepTin;

}