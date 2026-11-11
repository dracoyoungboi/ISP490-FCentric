package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Yêu cầu quản lý cửa hàng duyệt trả hàng quá 03 ngày (GBR-RET-02). Mỗi quản lý nhận một mã PIN riêng qua email
 * ({@link YeuCauDuyetTraHangMa}); nhập đúng mã nào thì người có mã đó là người duyệt.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "yeu_cau_duyet_tra_hang")
public class YeuCauDuyetTraHang {
    public static final String CHO_NHAP = "cho_nhap";
    public static final String DA_DUYET = "da_duyet";
    public static final String DA_DUNG = "da_dung";
    public static final String HET_LUOT = "het_luot";
    public static final String DA_THAY = "da_thay";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "don_ban_hang_id", nullable = false)
    Integer donBanHangId;

    @Column(name = "kho_id", nullable = false)
    Integer khoId;

    @Column(name = "nguoi_yeu_cau_id", nullable = false)
    Integer nguoiYeuCauId;

    @Column(name = "ly_do", nullable = false, length = 255)
    String lyDo;

    @Column(name = "trang_thai", nullable = false, length = 20)
    String trangThai;

    @Column(name = "so_lan_sai", nullable = false)
    Integer soLanSai;

    @Column(name = "het_han_luc", nullable = false)
    Instant hetHanLuc;

    @Column(name = "nguoi_duyet_id")
    Integer nguoiDuyetId;

    @Column(name = "duyet_luc")
    Instant duyetLuc;

    @Column(name = "ngay_tao", nullable = false)
    Instant ngayTao;
}
