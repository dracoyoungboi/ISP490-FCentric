package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "san_pham_quan_ao")
public class SanPhamQuanAo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_san_pham", nullable = false, length = 50)
    String maSanPham;

    @Size(max = 200)
    @NotNull
    @Column(name = "ten_san_pham", nullable = false, length = 200)
    String tenSanPham;

    /** Đơn vị tính in trên hóa đơn / phiếu kho (Cái, Bộ, Đôi…); CSDL mặc định "Cái". */
    @Size(max = 20)
    @ColumnDefault("'Cái'")
    @Column(name = "don_vi_tinh", length = 20)
    String donViTinh;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "danh_muc_id", nullable = false)
    DanhMucQuanAo danhMuc;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thuong_hieu_id")
    ThuongHieu thuongHieu;


    @Column(name = "mo_ta")
    String moTa;

    @Size(max = 100)
    @Column(name = "ma_vach", length = 100)
    String maVach;

    @ColumnDefault("0.00")
    @Column(name = "gia_von_mac_dinh", precision = 15, scale = 2)
    BigDecimal giaVonMacDinh;

    @ColumnDefault("0.00")
    @Column(name = "gia_ban_mac_dinh", precision = 15, scale = 2)
    BigDecimal giaBanMacDinh;

    @ColumnDefault("0")
    @Column(name = "muc_ton_toi_thieu")
    Integer mucTonToiThieu;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_tao_id")
    NguoiDung nguoiTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.UPDATE)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

    @OneToMany(mappedBy = "quanAo",
            fetch = FetchType.LAZY,
            cascade = CascadeType.ALL,
            orphanRemoval = true)
    @Builder.Default
    List<AnhQuanAo> anhQuanAos = new ArrayList<>();

    @OneToMany(mappedBy = "sanPham", fetch = FetchType.LAZY)
    List<BienTheSanPham> bienTheSanPhams;

    public static final String DON_VI_TINH_MAC_DINH = "Cái";

    /** Sản phẩm tạo mới chưa có đơn vị tính: ghi "Cái" (Hibernate ghi NULL tường minh nên mặc định của CSDL không áp dụng). */
    @PrePersist
    void ganDonViTinhMacDinh() {
        if (donViTinh == null || donViTinh.isBlank()) {
            donViTinh = DON_VI_TINH_MAC_DINH;
        }
    }
}