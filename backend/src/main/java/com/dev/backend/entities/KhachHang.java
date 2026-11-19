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
@Table(name = "khach_hang")
public class KhachHang {
    /**
     * Mã khách lẻ mặc định (seed ở pos_checkout_v1.sql): khách của hệ thống cho hóa đơn bán tại quầy không lưu
     * thông tin người mua. Không sửa, không ngừng hoạt động được; không tính là một khách trong danh sách, báo cáo.
     */
    public static final String MA_KHACH_LE = "KHLE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_khach_hang", nullable = false, length = 50)
    String maKhachHang;

    @Size(max = 200)
    @NotNull
    @Column(name = "ten_khach_hang", nullable = false, length = 200)
    String tenKhachHang;

    @Size(max = 20)
    @Column(name = "so_dien_thoai", length = 20)
    String soDienThoai;

    @Size(max = 100)
    @Column(name = "email", length = 100)
    String email;

    @Lob
    @Column(name = "dia_chi")
    String diaChi;

    @Builder.Default
    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai = 0;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.UPDATE)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;


}