package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "danh_sach_nhat_hang")
public class DanhSachNhatHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_pick_list", nullable = false, unique = true, length = 50)
    String maPickList;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kho_xuat_id", nullable = false)
    Kho khoXuat;

    /**
     * Phiếu xuất PX-CK khi đây là phiếu nhặt của phiếu chuyển kho (đặc tả bước 8: duyệt phiếu chuyển thì đẩy PX-CK vào
     * danh sách chờ nhặt), một phiếu nhặt ↔ một PX-CK. Trống = phiếu nhặt gom đơn bán. Loại phiếu suy ra từ cột này.
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phieu_xuat_kho_id", unique = true)
    PhieuXuatKho phieuXuatKho;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_nhat_id")
    NguoiDung nguoiNhat;

    @ColumnDefault("'cho_nhat'")
    @Column(name = "trang_thai", length = 20)
    @Builder.Default
    String trangThai = "cho_nhat";

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @Column(name = "ngay_hoan_tat")
    Instant ngayHoanTat;

    @OneToMany(mappedBy = "danhSachNhatHang", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    List<ChiTietNhatHang> chiTietNhatHangs;

    @OneToMany(mappedBy = "danhSachNhatHang", fetch = FetchType.LAZY)
    List<DonBanHang> donBanHangs;

    /** Phiếu nhặt của phiếu chuyển kho (nối PX-CK), không phải phiếu gom đơn bán. */
    public boolean laChuyenKho() {
        return phieuXuatKho != null;
    }
}

