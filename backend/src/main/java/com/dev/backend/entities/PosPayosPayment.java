package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Giao dịch chuyển khoản payOS tại quầy POS. Xem vòng đời trạng thái trong Database/payos_v1.sql.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "pos_payos_payment")
public class PosPayosPayment {
    public static final String PENDING = "PENDING";
    public static final String PAID = "PAID";
    public static final String CANCELLED = "CANCELLED";
    public static final String EXPIRED = "EXPIRED";
    public static final String FAILED = "FAILED";
    public static final String PAID_ERROR = "PAID_ERROR";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "order_code", nullable = false)
    Long orderCode;

    @Column(name = "request_id", nullable = false, length = 64)
    String requestId;

    @Column(name = "kho_id", nullable = false)
    Integer khoId;

    @Column(name = "nguoi_thu_ngan_id", nullable = false)
    Integer nguoiThuNganId;

    @Column(name = "so_tien", nullable = false, precision = 15, scale = 2)
    BigDecimal soTien;

    @Column(name = "trang_thai", nullable = false, length = 20)
    String trangThai;

    @Column(name = "payment_link_id", length = 64)
    String paymentLinkId;

    @Column(name = "checkout_url", length = 500)
    String checkoutUrl;

    @Column(name = "qr_code", columnDefinition = "TEXT")
    String qrCode;

    @Column(name = "bin", length = 20)
    String bin;

    @Column(name = "so_tai_khoan", length = 50)
    String soTaiKhoan;

    @Column(name = "ten_tai_khoan", length = 200)
    String tenTaiKhoan;

    @Column(name = "noi_dung_ck", length = 50)
    String noiDungCk;

    @Column(name = "payload_json", nullable = false, columnDefinition = "LONGTEXT")
    String payloadJson;

    @Column(name = "giu_cho_json", columnDefinition = "LONGTEXT")
    String giuChoJson;

    @Column(name = "don_ban_hang_id")
    Integer donBanHangId;

    @Column(name = "result_json", columnDefinition = "LONGTEXT")
    String resultJson;

    @Column(name = "ma_giao_dich_ngan_hang", length = 100)
    String maGiaoDichNganHang;

    @Column(name = "error_message", length = 500)
    String errorMessage;

    @Column(name = "het_han_luc", nullable = false)
    Instant hetHanLuc;

    @Column(name = "thanh_toan_luc")
    Instant thanhToanLuc;

    @Column(name = "ngay_tao")
    Instant ngayTao;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}
