package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Lệnh kiểm kê đã xử lý theo Idempotency-Key (BR-STK-12): gửi lặp cùng khóa và cùng nội dung thì trả lại kết quả cũ,
 * cùng khóa khác nội dung thì 409. Ghi trong cùng giao dịch với lệnh.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "kiem_ke_lenh")
public class KiemKeLenh {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "kho_id", nullable = false)
    Integer khoId;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    String idempotencyKey;

    @Column(name = "loai_lenh", nullable = false, length = 30)
    String loaiLenh;

    @Column(name = "payload_hash", nullable = false, length = 64)
    String payloadHash;

    @Column(name = "dot_kiem_ke_id")
    Integer dotKiemKeId;

    @Column(name = "ket_qua", nullable = false, columnDefinition = "json")
    String ketQua;

    @Column(name = "ngay_tao", nullable = false)
    Instant ngayTao;
}
