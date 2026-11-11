package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Phiếu trả hàng tại quầy RET-YYYYMMDD-XXXX (đặc tả BA "Trả hàng / Đổi hàng tại POS"): khách trả hàng của một hóa đơn
 * POS đã thanh toán ở cửa hàng bất kỳ. Cửa hàng bán (A) chịu giảm doanh thu theo ngày lập phiếu; cửa hàng nhận (B) chi
 * tiền hoàn và nhập hàng Đạt vào tồn qua phiếu PN-RET. Đơn gốc giữ trạng thái 5, chỉ đổi cột trang_thai_tra_hang.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phieu_tra_hang")
public class PhieuTraHang {
    public static final String HINH_THUC_TRA_HANG = "tra_hang";
    public static final String HOAN_TIEN_MAT = "tien_mat";
    public static final String HOAN_CHUYEN_KHOAN = "chuyen_khoan";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "so_phieu", nullable = false, length = 30)
    String soPhieu;

    @Column(name = "request_id", nullable = false, length = 64)
    String requestId;

    @Column(name = "don_ban_hang_id", nullable = false)
    Integer donBanHangId;

    @Column(name = "kho_ban_id", nullable = false)
    Integer khoBanId;

    @Column(name = "kho_nhan_id", nullable = false)
    Integer khoNhanId;

    @Column(name = "phieu_nhap_kho_id")
    Integer phieuNhapKhoId;

    @Column(name = "hinh_thuc", nullable = false, length = 20)
    String hinhThuc;

    @Column(name = "tong_so_luong", nullable = false, precision = 15, scale = 3)
    BigDecimal tongSoLuong;

    @Column(name = "so_luong_dat", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuongDat;

    @Column(name = "so_luong_loi", nullable = false, precision = 15, scale = 3)
    BigDecimal soLuongLoi;

    @Column(name = "tong_tien_hoan", nullable = false, precision = 15, scale = 2)
    BigDecimal tongTienHoan;

    @Column(name = "phuong_thuc_hoan", nullable = false, length = 20)
    String phuongThucHoan;

    @Column(name = "ngan_hang", length = 100)
    String nganHang;

    @Column(name = "so_tai_khoan", length = 30)
    String soTaiKhoan;

    @Column(name = "ten_chu_tai_khoan", length = 100)
    String tenChuTaiKhoan;

    @Column(name = "ma_giao_dich", length = 100)
    String maGiaoDich;

    @Column(name = "qua_han", nullable = false)
    Boolean quaHan;

    @Column(name = "yeu_cau_duyet_id")
    Integer yeuCauDuyetId;

    @Column(name = "nguoi_duyet_id")
    Integer nguoiDuyetId;

    @Column(name = "ly_do_duyet", length = 255)
    String lyDoDuyet;

    @Column(name = "ghi_chu", length = 500)
    String ghiChu;

    @Column(name = "nguoi_lap_id", nullable = false)
    Integer nguoiLapId;

    @Column(name = "ngay_tao", nullable = false)
    Instant ngayTao;
}
