package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Cấu hình cổng thanh toán (payOS). Các khóa bí mật lưu ĐÃ MÃ HÓA —
 * chỉ PaymentConfigService giải mã khi cần gọi payOS, không bao giờ trả về client.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "cau_hinh_thanh_toan")
public class CauHinhThanhToan {
    public static final String NCC_PAYOS = "PAYOS";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "nha_cung_cap", nullable = false, length = 20)
    String nhaCungCap;

    @Builder.Default
    @Column(name = "kich_hoat", nullable = false)
    Boolean kichHoat = false;

    @Column(name = "client_id_ma_hoa", columnDefinition = "TEXT")
    String clientIdMaHoa;

    @Column(name = "api_key_ma_hoa", columnDefinition = "TEXT")
    String apiKeyMaHoa;

    @Column(name = "checksum_key_ma_hoa", columnDefinition = "TEXT")
    String checksumKeyMaHoa;

    @Builder.Default
    @Column(name = "thoi_gian_het_han_phut", nullable = false)
    Integer thoiGianHetHanPhut = 15;

    @Column(name = "webhook_url", length = 500)
    String webhookUrl;

    @Column(name = "webhook_xac_nhan_luc")
    Instant webhookXacNhanLuc;

    @Column(name = "nguoi_cap_nhat_id")
    Integer nguoiCapNhatId;

    @Column(name = "ngay_tao", insertable = false, updatable = false)
    Instant ngayTao;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}
