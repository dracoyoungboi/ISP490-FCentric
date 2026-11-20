package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.Set;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phan_quyen_nguoi_dung_kho")
// Chỉ ghi cột thật sự đổi: dấu người quản lý chính (la_quan_ly_kho) được đổi bằng câu UPDATE thẳng
// (PhanQuyenNguoiDungKhoRepository); lần lưu thực thể đã nạp từ trước (đổi hạn, trạng thái) không được ghi lại dấu cũ.
@DynamicUpdate
public class PhanQuyenNguoiDungKho {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "nguoi_dung_id", nullable = false)
    NguoiDung nguoiDung;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "kho_id", nullable = false)
    Kho kho;

    @ColumnDefault("0")
    @Column(name = "la_quan_ly_kho")
    Integer laQuanLyKho;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @Column(name = "ngay_bat_dau")
    Instant ngayBatDau;

    @Column(name = "ngay_ket_thuc")
    Instant ngayKetThuc;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_cap_quyen_id")
    NguoiDung nguoiCapQuyen;

    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.UPDATE)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

    // join với chi tiết quyền hạn của kho
    @OneToMany(mappedBy = "phanQuyenNguoiDungKho", fetch = FetchType.LAZY)
    Set<ChiTietQuyenKho> chiTietQuyenKhos;

}