package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Hóa đơn của nhà cung cấp cho một phiếu nhập mua hàng (một-một). Nhập sau khi phiếu hoàn tất, sửa được tới khi phiếu
 * được xuất sang kế toán. Đơn giá đơn mua đã gồm thuế ("đã gồm thuế GTGT nếu có" trên thư gửi nhà cung cấp), nên khi
 * xuất, thuế tách theo {@link #thueSuat} của hóa đơn.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "hoa_don_dau_vao")
public class HoaDonDauVao {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "phieu_nhap_kho_id", nullable = false)
    PhieuNhapKho phieuNhapKho;

    /** false = nhà cung cấp không xuất hóa đơn GTGT (toàn bộ đơn giá là giá nhập, không có thuế đầu vào). */
    @NotNull
    @Column(name = "co_hoa_don", nullable = false)
    Boolean coHoaDon;

    @Size(max = 20) @Column(name = "mau_so", length = 20)
    String mauSo;

    @Size(max = 20) @Column(name = "ky_hieu", length = 20)
    String kyHieu;

    @Size(max = 20) @Column(name = "so_hoa_don", length = 20)
    String soHoaDon;

    @Column(name = "ngay_hoa_don")
    LocalDate ngayHoaDon;

    /** Thuế suất trên hóa đơn (%): 0, 5, 8, 10; null khi không có hóa đơn. */
    @Column(name = "thue_suat", precision = 5, scale = 2)
    BigDecimal thueSuat;

    @Column(name = "nguoi_cap_nhat_id")
    Integer nguoiCapNhatId;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}
