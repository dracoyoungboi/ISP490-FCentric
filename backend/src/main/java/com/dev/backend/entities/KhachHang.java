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

    /** Mã số thuế (khách sỉ / doanh nghiệp) — in ở khối Người mua của hóa đơn bán hàng. */
    @Size(max = 14)
    @Column(name = "ma_so_thue", length = 14)
    String maSoThue;

    @Size(max = 100)
    @Column(name = "nguoi_lien_he", length = 100)
    String nguoiLienHe;

    @Size(max = 20)
    @Column(name = "so_dien_thoai", length = 20)
    String soDienThoai;

    @Size(max = 100)
    @Column(name = "email", length = 100)
    String email;

    @Lob
    @Column(name = "dia_chi")
    String diaChi;

    @ColumnDefault("'le'")
    @Lob
    @Column(name = "loai_khach_hang")
    String loaiKhachHang;

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