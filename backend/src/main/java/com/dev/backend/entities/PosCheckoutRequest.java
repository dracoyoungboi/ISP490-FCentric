package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.Instant;

/**
 * Neo idempotency checkout POS: request_id UNIQUE ở DB là chốt chặn race
 * (không phải chỉ if-exists). Cùng key + cùng request_hash -> trả kết quả đã lưu;
 * cùng key + khác hash -> xung đột. SUCCESS lưu result_json để phục hồi sau timeout;
 * FAILED là lỗi nghiệp vụ xác định (khác với "không tìm thấy" = kết quả chưa rõ, được phép thử lại).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "pos_checkout_request")
public class PosCheckoutRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "request_id", nullable = false, length = 64)
    String requestId;

    @Column(name = "request_hash", nullable = false, length = 64)
    String requestHash;

    @Column(name = "kho_id", nullable = false)
    Integer khoId;

    @Column(name = "don_ban_hang_id")
    Integer donBanHangId;

    @ColumnDefault("'PENDING'")
    @Column(name = "trang_thai", nullable = false, length = 20)
    String trangThai;

    @Lob
    @Column(name = "result_json")
    String resultJson;

    @Column(name = "error_message", length = 500)
    String errorMessage;

    @Column(name = "nguoi_thu_ngan_id")
    Integer nguoiThuNganId;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

    public static final String TRANG_THAI_PENDING = "PENDING";
    public static final String TRANG_THAI_SUCCESS = "SUCCESS";
    public static final String TRANG_THAI_FAILED = "FAILED";
}
