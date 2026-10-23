package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;
import java.util.List;

@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "yeu_cau_mua_hang")
public class YeuCauMuaHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @Size(max = 50)
    @Column(name = "so_yeu_cau_mua_hang", nullable = false, length = 50)
    String soYeuCauMuaHang;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_nhap_id", nullable = false)
    private Kho khoNhap;

    @Column(name = "ngay_giao_du_kien")
    private Instant ngayGiaoDuKien;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    private Integer trangThai; //1: Chờ duyệt, 2: Đã duyệt, 3: Đã gửi yêu cầu báo giá cho nhà cung cấp, 4: Từ chối, 5: Đã chọn nhà cung cấp (chấp nhận một báo giá)

    @Column(name = "ghi_chu")
    private String ghiChu;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_tao_id")
    private NguoiDung nguoiTao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_duyet_id")
    private NguoiDung nguoiDuyet;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_tao")
    private Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_cap_nhat")
    private Instant ngayCapNhat;

    //Danh sách chi tiết yêu cầu mua hàng
    @OneToMany(mappedBy = "yeuCauMuaHang", fetch = FetchType.LAZY)
    private List<ChiTietYeuCauMuaHang> chiTietYeuCauMuaHangs;

    @OneToMany(mappedBy = "yeuCauMuaHang", fetch = FetchType.LAZY)
    private List<DonMuaHang> donMuaHangs;
}