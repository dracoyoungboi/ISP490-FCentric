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
@Table(name = "ma_vach_nha_cung_cap")
public class MaVachNhaCungCap {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nha_cung_cap_id", nullable = false)
    NhaCungCap nhaCungCap;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @Size(max = 100)
    @NotNull
    @Column(name = "barcode_ncc", nullable = false, length = 100)
    String barcodeNcc;

    @Size(max = 100)
    @Column(name = "ma_san_pham_ncc", length = 100)
    String maSanPhamNcc;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phieu_nhap_kho_id")
    PhieuNhapKho phieuNhapKho;

    @Size(max = 255)
    @Column(name = "ghi_chu", length = 255)
    String ghiChu;

    /** Người xác nhận liên kết lúc kiểm đếm (cột "Liên kết từ" ở trang Mã vạch nhà cung cấp). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_lien_ket_id")
    NguoiDung nguoiLienKet;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;
}

