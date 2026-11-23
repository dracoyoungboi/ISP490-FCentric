package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chi_tiet_don_mua_hang")
public class ChiTietDonMuaHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "don_mua_hang_id", nullable = false)
    DonMuaHang donMuaHang;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @NotNull
    @Column(name = "so_luong_dat", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuongDat;

    /**
     * Số đã xong của dòng: hàng đạt đã nhập kho + hàng lỗi đã chốt trừ tiền với nhà cung cấp (không giao lại). Hàng lỗi
     * chờ chốt / chờ giao bù không cộng vào đây nên vẫn là còn thiếu. Số trừ tiền của từng biến thể ghi trong nhật ký biên
     * bản trả hàng (NhatKyTraHangNcc), giao diện tách "đạt" = đã nhận − trừ tiền.
     */
    @ColumnDefault("0.000")
    @Column(name = "so_luong_da_nhan", precision = 15, scale = 3)
    BigDecimal soLuongDaNhan;

    /** Còn thiếu = đặt − đã nhận (không âm). */
    public BigDecimal conThieu() {
        BigDecimal dat = soLuongDat == null ? BigDecimal.ZERO : soLuongDat;
        BigDecimal nhan = soLuongDaNhan == null ? BigDecimal.ZERO : soLuongDaNhan;
        return dat.subtract(nhan).max(BigDecimal.ZERO);
    }

    @NotNull
    @Column(name = "don_gia", nullable = false, precision = 15, scale = 2)
    BigDecimal donGia;

    @ColumnDefault("(`so_luong_dat` * `don_gia`)")
    @Column(name = "thanh_tien", precision = 15, scale = 2)
    @Generated(event = EventType.INSERT)
    BigDecimal thanhTien;

    @Column(name = "ghi_chu")
    String ghiChu;


}