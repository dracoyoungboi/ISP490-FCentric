package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Kết quả một lần đếm, lưu lại trước khi dòng được mở để đếm lại (BR-STK-08). Không sửa, không xóa qua API.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "kiem_ke_lan_dem")
public class KiemKeLanDem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "chi_tiet_kiem_ke_id", nullable = false)
    Integer chiTietKiemKeId;

    @Column(name = "lan_kiem_dem", nullable = false)
    Integer lanKiemDem;

    @Column(name = "so_luong_he_thong", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuongHeThong;

    @Column(name = "gia_von_he_thong", nullable = false, precision = 15, scale = 2)
    BigDecimal giaVonHeThong;

    @Column(name = "so_luong_thuc_te", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuongThucTe;

    @Column(name = "ly_do_chenh_lech")
    String lyDoChenhLech;

    @Column(name = "bien_phap_xu_ly")
    String bienPhapXuLy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_kiem_dem_id")
    NguoiDung nguoiKiemDem;

    @Column(name = "ngay_kiem_dem")
    Instant ngayKiemDem;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nguoi_yeu_cau_id", nullable = false)
    NguoiDung nguoiYeuCau;

    @Column(name = "ly_do_kiem_lai", nullable = false)
    String lyDoKiemLai;

    @Column(name = "ngay_yeu_cau", nullable = false)
    Instant ngayYeuCau;

    /** Danh sách id ảnh (anh_kiem_ke) của lần đếm này, dạng JSON mảng số. */
    @Column(name = "anh_tham_chieu", columnDefinition = "json")
    String anhThamChieu;
}
