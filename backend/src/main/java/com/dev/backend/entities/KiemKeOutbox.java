package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Sự kiện đẩy tồn lên kênh bán sau khi duyệt kiểm kê (BR-STK-14). Ghi cùng giao dịch duyệt; worker gửi sau commit,
 * giữ lease khi gửi, thử lại có giãn cách và luôn đọc tồn khả dụng mới nhất.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "kiem_ke_outbox")
public class KiemKeOutbox {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "dot_kiem_ke_id", nullable = false)
    Integer dotKiemKeId;

    @Column(name = "kho_id", nullable = false)
    Integer khoId;

    @Column(name = "bien_the_san_pham_id", nullable = false)
    Integer bienTheSanPhamId;

    @Column(name = "payload", nullable = false, columnDefinition = "json")
    String payload;

    /** 1 = tồn khả dụng sau duyệt dưới REALTIME_SYNC_THRESHOLD: gửi ngay sau commit. */
    @Column(name = "uu_tien", nullable = false)
    @Builder.Default
    Integer uuTien = 0;

    @Column(name = "trang_thai", nullable = false)
    String trangThai;

    @Column(name = "so_lan_thu", nullable = false)
    @Builder.Default
    Integer soLanThu = 0;

    @Column(name = "thu_lai_luc", nullable = false)
    Instant thuLaiLuc;

    @Column(name = "lease_den")
    Instant leaseDen;

    @Column(name = "lease_token", length = 64)
    String leaseToken;

    @Column(name = "ket_qua_kenh", columnDefinition = "json")
    String ketQuaKenh;

    @Column(name = "loi_cuoi")
    String loiCuoi;

    @Column(name = "ngay_tao", nullable = false)
    Instant ngayTao;

    @Column(name = "ngay_gui")
    Instant ngayGui;
}
