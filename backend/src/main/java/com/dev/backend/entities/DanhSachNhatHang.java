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
}

