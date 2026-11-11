package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Phiếu chuyển kệ nội bộ MV-YYYYMMDD-XXXX (UC-7.4, BA phần V): một lượt Scan-to-Move đổi chỗ hàng giữa các kệ của cùng
 * một kho. Tồn kho của kho không đổi (BR-BIN-01), chỉ sổ tồn theo kệ (ton_kho_vi_tri) đổi. Chi tiết ở
 * {@link ChiTietPhieuChuyenKe}; phiếu không sửa, không xóa sau khi tạo (lưu vết bất biến).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phieu_chuyen_ke")
public class PhieuChuyenKe {

    public static final String TRUC_TIEP = "TRUC_TIEP";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "ma_phieu", nullable = false, length = 50)
    String maPhieu;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_id", nullable = false)
    Kho kho;

    @Column(name = "loai_chuyen", nullable = false, length = 20)
    @Builder.Default
    String loaiChuyen = TRUC_TIEP;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nguoi_thuc_hien_id", nullable = false)
    NguoiDung nguoiThucHien;

    @Column(name = "ngay_thuc_hien", nullable = false)
    Instant ngayThucHien;

    /** Quản lý kho cho cất vượt sức chứa kệ đích (Manager Override, BR-BIN-05). */
    @Column(name = "vuot_suc_chua", nullable = false)
    @Builder.Default
    Boolean vuotSucChua = false;

    @Column(name = "ghi_chu", length = 255)
    String ghiChu;
}
