package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "don_mua_hang")
public class DonMuaHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "yeu_cau_mua_hang_id", nullable = false)
    YeuCauMuaHang yeuCauMuaHang;

    @Size(max = 50)
    @Column(name = "so_don_mua", nullable = false, length = 50)
    String soDonMua;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nha_cung_cap_id", nullable = false)
    NhaCungCap nhaCungCap;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_nhap_id", nullable = false)
    Kho khoNhap;

    @NotNull
    @Column(name = "ngay_dat_hang", nullable = false)
    Instant ngayDatHang;

    @Column(name = "ngay_giao_du_kien")
    Instant ngayGiaoDuKien;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;
    // 1 là đã gửi (cũ), 2 là chờ / đã báo giá (đã báo giá ⇔ ngayBaoGia != null), 3 là chấp nhận báo giá, đang vận
    // chuyển, 4 là không chấp nhận báo giá (kể cả khi đã chọn nhà cung cấp khác cùng yêu cầu), 5 là đã nhận đủ hàng
    @ColumnDefault("0.00")
    @Column(name = "tong_tien", precision = 15, scale = 2)
    BigDecimal tongTien;

    @Column(name = "ghi_chu")
    String ghiChu;

    /**
     * Lần cuối nhà cung cấp gửi báo giá trên cổng. null = chưa báo giá.
     * Không dùng ngay_cap_nhat thay được: cột đó tự đổi (ON UPDATE) mỗi lần sửa đơn.
     */
    @Column(name = "ngay_bao_gia")
    Instant ngayBaoGia;

    /** Lúc email Yêu cầu báo giá gửi được tới nhà cung cấp. null = chưa gửi được. */
    @Column(name = "ngay_gui_yeu_cau")
    Instant ngayGuiYeuCau;

    /** Ghi chú nhà cung cấp gửi kèm báo giá (là một phần của báo giá). Khác ghi_chu là ghi chú của bên mua. */
    @Column(name = "ghi_chu_nha_cung_cap", columnDefinition = "TEXT")
    String ghiChuNhaCungCap;

    /** Lý do không chấp nhận báo giá; không bắt buộc. */
    @Size(max = 500)
    @Column(name = "ly_do_tu_choi", length = 500)
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


    // Danh sách chi tiết đơn mua hàng
    @OneToMany(mappedBy = "donMuaHang", fetch = FetchType.LAZY)
    @OrderBy("id ASC")
    List<ChiTietDonMuaHang> chiTietDonMuaHangs;


}