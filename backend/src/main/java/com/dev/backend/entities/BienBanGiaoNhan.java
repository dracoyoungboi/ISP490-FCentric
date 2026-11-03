package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Biên bản giao nhận (BBGN) khi kho nhận nhận thiếu hoặc hỏng: kho nhận và lái xe ký trên giấy, kho gửi xác nhận trên
 * F Centric (BA 03/11, {@code ngayXacNhanGui}). Phương án xử lý một lần cho cả biên bản (đặc tả bước 5), chỉ sau khi kho
 * gửi đã xác nhận: CHUA_XU_LY → GHI_GIAM_HAO_HUT | GIAO_BU_HANG.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "bien_ban_giao_nhan")
public class BienBanGiaoNhan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @Column(name = "so_bien_ban", nullable = false, length = 50)
    String soBienBan;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "phieu_chuyen_kho_id", nullable = false)
    PhieuChuyenKho phieuChuyenKho;

    @NotNull
    @Column(name = "ngay_lap", nullable = false)
    Instant ngayLap;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nguoi_lap_id", nullable = false)
    NguoiDung nguoiLap;

    @NotNull
    @Column(name = "nguoi_van_chuyen", nullable = false, length = 100)
    String nguoiVanChuyen;

    @Column(name = "tong_so_luong_gui", nullable = false)
    Integer tongSoLuongGui;

    @Column(name = "tong_so_luong_nhan", nullable = false)
    Integer tongSoLuongNhan;

    @Column(name = "tong_so_luong_thieu", nullable = false)
    Integer tongSoLuongThieu;

    @Column(name = "tong_so_luong_hong", nullable = false)
    Integer tongSoLuongHong;

    @Column(name = "ghi_chu")
    String ghiChu;

    /** Đại diện kho gửi xác nhận biên bản trên F Centric (thay chữ ký tay ô "Đại diện kho gửi"). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_xac_nhan_gui_id")
    NguoiDung nguoiXacNhanGui;

    /** Lúc kho gửi xác nhận; null = chưa xác nhận, chưa xử lý chênh lệch được. */
    @Column(name = "ngay_xac_nhan_gui")
    Instant ngayXacNhanGui;

    /** Ý kiến của kho gửi khi xác nhận (không bắt buộc), vd. hàng đóng nguyên thùng lúc xuất. */
    @Column(name = "ghi_chu_kho_gui")
    String ghiChuKhoGui;

    @Column(name = "phuong_an_xu_ly")
    String phuongAnXuLy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_duyet_xu_ly_id")
    NguoiDung nguoiDuyetXuLy;

    @Column(name = "ngay_duyet_xu_ly")
    Instant ngayDuyetXuLy;
}
