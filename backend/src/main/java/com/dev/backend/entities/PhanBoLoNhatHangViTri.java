package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/**
 * Phần của một phân bổ lô phiếu nhặt nằm ở từng kệ (đặc tả BA 8.2: FIFO ghi chi tiết vị trí cùng giao dịch). Phần còn
 * lại của phân bổ (nếu có) lấy ở hàng chưa có kệ. Xóa theo phân bổ cha (ON DELETE CASCADE).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phan_bo_lo_nhat_hang_vi_tri")
public class PhanBoLoNhatHangViTri {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "phan_bo_lo_nhat_hang_id", nullable = false)
    Integer phanBoLoNhatHangId;

    @Column(name = "vi_tri_kho_id", nullable = false)
    Integer viTriKhoId;

    @Column(name = "so_luong", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuong;
}
