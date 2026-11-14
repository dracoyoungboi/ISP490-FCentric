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
    /** Lô chứa chứng từ đã bị hủy: chứng từ quay về "chưa xuất" (khoa_hieu_luc thành NULL) và vào lô sau. */
    public static final String TRANG_THAI_DA_HUY_LO = "da_huy_lo";

    public static final String LOAI_BAN_HANG = "ban_hang";
    public static final String LOAI_MUA_HANG = "mua_hang";
    public static final String LOAI_CHUYEN_KHO_XUAT = "chuyen_kho_xuat";
    public static final String LOAI_CHUYEN_KHO_NHAN = "chuyen_kho_nhan";
    public static final String LOAI_TON_DAU_KY = "ton_dau_ky";
    /** Phiếu trả hàng tại quầy (phieu_tra_hang.id): một hoặc hai chứng từ Hàng bán trả lại (hàng đạt / hàng lỗi). */
    public static final String LOAI_TRA_LAI_QUAY = "tra_lai_quay";
    /** Đơn bán đã giao kế toán rồi bị hoàn trả (don_ban_hang.id): chứng từ Hàng bán trả lại, giảm trừ công nợ. */
    public static final String LOAI_TRA_LAI_DON = "tra_lai_don";
    /**
     * Phiếu nhập / xuất kho khác dựng từ biến động kho, theo bảng nguồn (id_nguon là id của bảng đó): dck =
     * phieu_dieu_chinh_kho (kiểm kê, hao hụt chuyển kho), pxk = phieu_xuat_kho (xuất khác), pnk = phieu_nhap_kho (nhập khác).
     */
    public static final String LOAI_NHAP_KHAC_DCK = "nhap_khac_dck";
    public static final String LOAI_XUAT_KHAC_DCK = "xuat_khac_dck";
    public static final String LOAI_NHAP_KHAC_PXK = "nhap_khac_pxk";
    public static final String LOAI_XUAT_KHAC_PXK = "xuat_khac_pxk";
    public static final String LOAI_NHAP_KHAC_PNK = "nhap_khac_pnk";
    public static final String LOAI_XUAT_KHAC_PNK = "xuat_khac_pnk";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lo_xuat_id", nullable = false)
    LoXuatKeToan loXuat;

    /**
     * ban_hang (don_ban_hang.id), mua_hang / chuyen_kho_nhan (phieu_nhap_kho.id), chuyen_kho_xuat (phieu_xuat_kho.id),
     * ton_dau_ky (0), tra_lai_quay (phieu_tra_hang.id), tra_lai_don (don_ban_hang.id), nhap_khac_* / xuat_khac_* (xem trên).
     */
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

    /** Mã khách ghi trên chứng từ AMIS (bán, trả lại); null = chứng từ trước 14/11/2026 ghi mã riêng của khách. */
    @Size(max = 50)
    @Column(name = "ma_khach", length = 50)
    String maKhach;

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
