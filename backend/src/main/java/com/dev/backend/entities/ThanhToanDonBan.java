package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Phiếu thu (THU) hoặc phiếu hoàn (HOAN) của một đơn bán thường. Không sửa, không xóa: ghi nhầm thì quản trị viên hủy
 * (DA_HUY) có lý do rồi lập phiếu mới. Trạng thái thanh toán của đơn tính từ các phiếu còn hiệu lực
 * (ThanhToanDonBanService). Bán tại quầy không ghi ở đây (sổ thu pos_payment).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "thanh_toan_don_ban")
public class ThanhToanDonBan {
    public static final String LOAI_THU = "THU";
    public static final String LOAI_HOAN = "HOAN";

    public static final String TIEN_MAT = "TIEN_MAT";
    public static final String CHUYEN_KHOAN = "CHUYEN_KHOAN";

    public static final String HIEU_LUC = "HIEU_LUC";
    public static final String DA_HUY = "DA_HUY";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Column(name = "don_ban_hang_id", nullable = false)
    Integer donBanHangId;

    @Column(name = "loai", nullable = false, length = 10)
    String loai;

    @Column(name = "phuong_thuc", nullable = false, length = 20)
    String phuongThuc;

    @Column(name = "so_tien", nullable = false, precision = 15, scale = 2)
    BigDecimal soTien;

    /** Mã giao dịch trên sao kê (chuyển khoản). */
    @Column(name = "ma_tham_chieu", length = 100)
    String maThamChieu;

    /** Kho xuất của đơn lúc ghi (lọc báo cáo theo cửa hàng). */
    @Column(name = "kho_id")
    Integer khoId;

    /** Ngày khách trả; chuyển khoản ghi lùi ngày thì là giữa trưa ngày đó (giờ ghi thật ở ngayTao). */
    @Column(name = "thoi_diem_thu", nullable = false)
    Instant thoiDiemThu;

    @Column(name = "nguoi_thu_id", nullable = false)
    Integer nguoiThuId;

    @Column(name = "trang_thai", nullable = false, length = 10)
    String trangThai;

    @Column(name = "ly_do_huy", length = 500)
    String lyDoHuy;

    @Column(name = "nguoi_huy_id")
    Integer nguoiHuyId;

    @Column(name = "huy_luc")
    Instant huyLuc;

    @Column(name = "ghi_chu", length = 500)
    String ghiChu;

    @Column(name = "ngay_tao", nullable = false)
    Instant ngayTao;

    /** Khóa trình duyệt sinh cho một lần ghi thu / hoàn: gửi lại cùng khóa không ghi phiếu thứ hai (UNIQUE). */
    @Column(name = "khoa_chong_trung", length = 64)
    String khoaChongTrung;

    /** Chuyển khoản: quản trị viên đã đối chiếu với sao kê lúc này (null = chưa). Phiếu vẫn tính đã thu ngay. */
    @Column(name = "doi_chieu_luc")
    Instant doiChieuLuc;

    @Column(name = "nguoi_doi_chieu_id")
    Integer nguoiDoiChieuId;

    /** Mã hiển thị: lấy từ id nên không bao giờ trùng (không đếm như số đơn). */
    public String maPhieu() {
        return id == null ? null : (LOAI_HOAN.equals(loai) ? "PH-" : "PT-") + id;
    }

    public boolean hieuLuc() {
        return HIEU_LUC.equals(trangThai);
    }
}
