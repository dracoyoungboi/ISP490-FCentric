package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "don_ban_hang")
// Chỉ ghi cột đã đổi: luồng kho nạp đơn không khóa rồi lưu không được ghi lại trạng thái thanh toán cũ (phiếu thu vừa
// ghi ở giao dịch khác đã đổi cột này)
@DynamicUpdate
public class DonBanHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "so_don_hang", nullable = false, length = 50)
    String soDonHang;

    @ColumnDefault("'don_ban_hang'")
    @Column(name = "loai_chung_tu", length = 20)
    String loaiChungTu;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "khach_hang_id", nullable = false)
    KhachHang khachHang;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kho_xuat_id")
    Kho khoXuat;

    @NotNull
    @Column(name = "ngay_dat_hang", nullable = false)
    Instant ngayDatHang;

    @Column(name = "ngay_giao_hang")
    Instant ngayGiaoHang;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @ColumnDefault("0.00")
    @Column(name = "tien_hang", precision = 15, scale = 2)
    BigDecimal tienHang;

    @ColumnDefault("0.00")
    @Column(name = "phi_van_chuyen", precision = 15, scale = 2)
    BigDecimal phiVanChuyen;

    @ColumnDefault("0.00")
    @Column(name = "tong_cong", precision = 15, scale = 2)
    BigDecimal tongCong;

    /** Thuế suất GTGT (%) chụp lúc chốt đơn; null = hóa đơn không in thuế (tắt thuế, đơn sàn, đơn cũ). */
    @Column(name = "thue_suat_gtgt", precision = 5, scale = 2)
    BigDecimal thueSuatGtgt;

    /** Tiền thuế GTGT đã gồm trong tổng cộng (giá bán đã gồm thuế), làm tròn tới đồng. */
    @Column(name = "tien_thue_gtgt", precision = 15, scale = 2)
    BigDecimal tienThueGtgt;

    // KHÔNG dùng @Generated(INSERT): app ghi giá trị tường minh ở mọi nơi
    // (create -> chua_thanh_toan, checkout POS -> da_thanh_toan); DB default chỉ
    // dự phòng cho các lệnh SQL thô. Trước đây @Generated khiến Hibernate bỏ qua
    // giá trị app ghi và cột luôn nhận default — đơn không bao giờ thành "đã thanh toán".
    @ColumnDefault("'chua_thanh_toan'")
    @Lob
    @Column(name = "trang_thai_thanh_toan")
    String trangThaiThanhToan;

    @Lob
    @Column(name = "dia_chi_giao_hang")
    String diaChiGiaoHang;

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @Lob
    @Column(name = "ly_do_tu_choi")
    String lyDoTuChoi;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_tao_id")
    NguoiDung nguoiTao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_duyet_id")
    NguoiDung nguoiDuyet;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kenh_ban_id")
    KenhBanHang kenhBanHang;

    @Size(max = 100)
    @Column(name = "ma_don_hang_kenh", length = 100)
    String maDonHangKenh;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "danh_sach_nhat_hang_id")
    DanhSachNhatHang danhSachNhatHang;

    @BatchSize(size = 50)
    @OneToMany(mappedBy = "donBanHang", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private List<ChiTietDonBanHang> chiTietDonBanHangs;
}
