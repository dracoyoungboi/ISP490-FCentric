package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Chứng từ đã vào một lô xuất kế toán. Chứng từ còn {@link #TRANG_THAI_DA_XUAT} bị khóa: không vào lô khác (cột sinh
 * khoa_hieu_luc UNIQUE trong CSDL, không map ở đây) và không sửa được phần đã gửi kế toán. Quản trị viên mở khóa thì
 * chuyển sang {@link #TRANG_THAI_DA_MO_KHOA}, chứng từ quay về "chưa xuất" và vào lô sau.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "chung_tu_xuat_ke_toan")
public class ChungTuXuatKeToan {
    public static final String TRANG_THAI_DA_XUAT = "da_xuat";
    public static final String TRANG_THAI_DA_MO_KHOA = "da_mo_khoa";

    public static final String LOAI_BAN_HANG = "ban_hang";
    public static final String LOAI_MUA_HANG = "mua_hang";
    public static final String LOAI_CHUYEN_KHO_XUAT = "chuyen_kho_xuat";
    public static final String LOAI_CHUYEN_KHO_NHAN = "chuyen_kho_nhan";
    public static final String LOAI_TON_DAU_KY = "ton_dau_ky";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lo_xuat_id", nullable = false)
    LoXuatKeToan loXuat;

    /** ban_hang (don_ban_hang.id), mua_hang / chuyen_kho_nhan (phieu_nhap_kho.id), chuyen_kho_xuat (phieu_xuat_kho.id), ton_dau_ky (0). */
    @NotNull @Size(max = 30)
    @Column(name = "loai", nullable = false, length = 30)
    String loai;

    @NotNull
    @Column(name = "id_nguon", nullable = false)
    Integer idNguon;

    @NotNull @Size(max = 60)
    @Column(name = "so_chung_tu", nullable = false, length = 60)
    String soChungTu;

    @NotNull
    @Column(name = "ngay_hach_toan", nullable = false)
    LocalDate ngayHachToan;

    @NotNull
    @Column(name = "tong_tien", nullable = false, precision = 18, scale = 2)
    BigDecimal tongTien;

    @NotNull @Size(max = 20)
    @Column(name = "trang_thai", nullable = false, length = 20)
    String trangThai;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_mo_khoa_id")
    NguoiDung nguoiMoKhoa;

    @Column(name = "mo_khoa_luc")
    Instant moKhoaLuc;

    @Size(max = 500)
    @Column(name = "ly_do_mo_khoa", length = 500)
    String lyDoMoKhoa;
}
