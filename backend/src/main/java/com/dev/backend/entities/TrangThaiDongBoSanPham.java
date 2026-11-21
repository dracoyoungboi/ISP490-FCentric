package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.math.BigDecimal;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "trang_thai_dong_bo_san_pham")
public class TrangThaiDongBoSanPham {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bien_the_san_pham_id", nullable = false)
    BienTheSanPham bienTheSanPham;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kenh_ban_id", nullable = false)
    KenhBanHang kenhBanHang;

    @Size(max = 100)
    @Column(name = "ma_san_pham_kenh", length = 100)
    String maSanPhamKenh;

    @Column(name = "trang_thai_dong_bo")
    @Builder.Default
    String trangThaiDongBo = "chua_dong_bo";

    @Column(name = "cho_phep_dong_bo", nullable = false)
    @Builder.Default
    Boolean choPhepDongBo = true;

    @Column(name = "chi_tiet_loi", columnDefinition = "TEXT")
    String chiTietLoi;

    @Column(name = "gia_ban_san", precision = 15, scale = 2)
    BigDecimal giaBanSan;

    @Column(name = "ngay_dong_bo_cuoi")
    Instant ngayDongBoCuoi;

    /** Số tồn sàn đã nhận ở lần đẩy thành công gần nhất; null = chưa đẩy lần nào */
    @Column(name = "so_luong_da_day")
    Integer soLuongDaDay;

    /** Thời điểm đẩy tồn thành công gần nhất */
    @Column(name = "ngay_day_ton_cuoi")
    Instant ngayDayTonCuoi;

    /** Tỷ lệ giữ tồn an toàn trên sàn (%) riêng cho SKU (0..50); null = không giữ buffer thêm */
    @Column(name = "buffer_percent")
    Integer bufferPercent;

    /** Ngưỡng kích hoạt đồng bộ tức thời (Threshold_RT,k) riêng cho SKU; null = dùng cấu hình toàn cục REALTIME_SYNC_THRESHOLD */
    @Column(name = "realtime_threshold")
    Integer realtimeThreshold;
}

