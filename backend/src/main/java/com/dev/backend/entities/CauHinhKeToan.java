package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Cấu hình xuất dữ liệu kế toán — bảng một dòng (id luôn = 1).
 * Tài khoản mặc định lấy theo hệ thống tài khoản TT 99/2025 của AMIS Kế toán doanh nghiệp (156 và 511 không có
 * tài khoản con); kế toán sửa lại cho khớp danh mục tài khoản của doanh nghiệp (AMIS chỉ nhận tài khoản chi tiết nhất).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "cau_hinh_ke_toan")
public class CauHinhKeToan {
    public static final int ID = 1;

    @Id
    @Column(name = "id", nullable = false)
    Integer id;

    /** Bộ tệp mẫu dùng khi xuất (hiện chỉ AMIS_DOANH_NGHIEP). */
    @NotNull
    @Size(max = 30)
    @Column(name = "ho_so", nullable = false, length = 30)
    String hoSo;

    /**
     * Ngày bắt đầu chuyển sang kế toán (trùng "Ngày bắt đầu dữ liệu" trên AMIS): tồn đầu kỳ tính tại đầu ngày này,
     * chứng từ có ngày hạch toán trước ngày này không bao giờ được xuất. Chưa đặt thì chưa xuất được.
     */
    @Column(name = "ngay_moc")
    LocalDate ngayMoc;

    @NotNull @Size(max = 20) @Column(name = "tk_tien_mat", nullable = false, length = 20)
    String tkTienMat;
    @NotNull @Size(max = 20) @Column(name = "tk_ngan_hang", nullable = false, length = 20)
    String tkNganHang;
    @NotNull @Size(max = 20) @Column(name = "tk_phai_thu", nullable = false, length = 20)
    String tkPhaiThu;
    @NotNull @Size(max = 20) @Column(name = "tk_doanh_thu", nullable = false, length = 20)
    String tkDoanhThu;
    @NotNull @Size(max = 20) @Column(name = "tk_chiet_khau", nullable = false, length = 20)
    String tkChietKhau;
    @NotNull @Size(max = 20) @Column(name = "tk_thue_dau_ra", nullable = false, length = 20)
    String tkThueDauRa;
    @NotNull @Size(max = 20) @Column(name = "tk_kho", nullable = false, length = 20)
    String tkKho;
    @NotNull @Size(max = 20) @Column(name = "tk_gia_von", nullable = false, length = 20)
    String tkGiaVon;
    @NotNull @Size(max = 20) @Column(name = "tk_phai_tra", nullable = false, length = 20)
    String tkPhaiTra;
    @NotNull @Size(max = 20) @Column(name = "tk_thue_dau_vao", nullable = false, length = 20)
    String tkThueDauVao;

    /** Mã hàng (tính chất Dịch vụ) của dòng phí vận chuyển thu khách trên chứng từ bán hàng. */
    @NotNull @Size(max = 50) @Column(name = "ma_dich_vu_van_chuyen", nullable = false, length = 50)
    String maDichVuVanChuyen;
    @NotNull @Size(max = 100) @Column(name = "ten_dich_vu_van_chuyen", nullable = false, length = 100)
    String tenDichVuVanChuyen;

    /** Hình thức của bước xuất chuyển kho (kho nguồn → kho Hàng đang chuyển) trên AMIS. */
    @NotNull @Size(max = 50) @Column(name = "hinh_thuc_chuyen_kho", nullable = false, length = 50)
    String hinhThucChuyenKho;

    /** Số tài khoản nhận tiền chuyển khoản tại quầy (cột "Nộp vào TK"); phải là tài khoản đã khai báo trên AMIS. */
    @Size(max = 30) @Column(name = "so_tk_ngan_hang_nhan", length = 30)
    String soTkNganHangNhan;

    @NotNull
    @Column(name = "version", nullable = false)
    Integer version;

    @Column(name = "nguoi_cap_nhat_id")
    Integer nguoiCapNhatId;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;
}
