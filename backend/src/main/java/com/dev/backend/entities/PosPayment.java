package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Sổ thu tiền mặt POS — chứng từ thanh toán có thể đối soát (không phải cờ paid).
 * so_tien_hang là doanh thu server tính; so_tien_thua là tiền thừa trả khách,
 * không cộng vào doanh thu. Mỗi request_id có đúng một phiếu thu (unique).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "pos_payment")
public class PosPayment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "request_id", nullable = false, length = 64)
    String requestId;

    @Column(name = "don_ban_hang_id", nullable = false)
    Integer donBanHangId;

    @ColumnDefault("'CASH'")
    @Column(name = "phuong_thuc", nullable = false, length = 20)
    String phuongThuc;

    @Column(name = "so_tien_hang", nullable = false, precision = 15, scale = 2)
    BigDecimal soTienHang;

    @Column(name = "so_tien_thu", nullable = false, precision = 15, scale = 2)
    BigDecimal soTienThu;

    @ColumnDefault("0.00")
    @Column(name = "so_tien_thua", nullable = false, precision = 15, scale = 2)
    BigDecimal soTienThua;

    @Column(name = "nguoi_thu_id", nullable = false)
    Integer nguoiThuId;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;
}
