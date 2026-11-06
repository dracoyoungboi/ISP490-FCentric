package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "lich_su_thay_doi")
public class LichSuThayDoi {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @Column(name = "loai_tham_chieu", length = 50)
    String loaiThamChieu;

    @Column(name = "id_tham_chieu")
    Integer idThamChieu;

    // Mã dễ đọc của đối tượng lúc ghi (số đơn, mã NCC, mã kho…); dòng cũ để trống
    @Size(max = 100)
    @Column(name = "ma_doi_tuong", length = 100)
    String maDoiTuong;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kho_id")
    Kho kho;

    @Size(max = 50)
    @Column(name = "hanh_dong", length = 50)
    String hanhDong;

    @Column(name = "gia_tri_cu")
    String giaTriCu;

    @Column(name = "gia_tri_moi")
    String giaTriMoi;

    // Trống khi việc do hệ thống / sàn làm — xem cột nguon
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_thuc_hien_id")
    NguoiDung nguoiThucHien;

    // Ai gây ra thay đổi: nguoi_dung / he_thong / shopify / lazada / tiktok / shopee (INguonNhatKy).
    // Dòng cũ để trống = người dùng.
    @Size(max = 30)
    @Column(name = "nguon", length = 30)
    String nguon;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "ngay_thuc_hien")
    Instant ngayThucHien;

    @Column(name = "ghi_chu")
    String ghiChu;


}