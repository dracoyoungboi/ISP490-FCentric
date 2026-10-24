package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "bien_the_san_pham")
// UPDATE chỉ ghi cột đã đổi: giao dịch hoàn tất phiếu nhập/xuất (tính lại giá vốn) chạy song song với lần đổi giá bán
// không ghi đè gia_ban vừa lưu bằng giá cũ đã nạp từ đầu giao dịch
@DynamicUpdate
public class BienTheSanPham {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "san_pham_id", nullable = false)
    SanPhamQuanAo sanPham;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mau_sac_id", nullable = false)
    MauSac mauSac;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "size_id", nullable = false)
    com.dev.backend.entities.Size size;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chat_lieu_id", nullable = false)
    ChatLieu chatLieu;

    @Size(max = 100)
    @NotNull
    @Column(name = "ma_sku", nullable = false, length = 100)
    String maSku;

    @Size(max = 100)
    @Column(name = "ma_vach_sku", length = 100)
    String maVachSku;

    @ColumnDefault("0.00")
    @Column(name = "gia_von", precision = 15, scale = 2)
    BigDecimal giaVon;

    @ColumnDefault("0.00")
    @Column(name = "gia_ban", precision = 15, scale = 2)
    BigDecimal giaBan;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_cap_nhat")
    @Generated(event = EventType.INSERT)
    Instant ngayCapNhat;

    @OneToOne(mappedBy = "bienThe")
    AnhBienThe anhBienThe;


}