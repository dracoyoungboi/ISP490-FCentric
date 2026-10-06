package com.dev.backend.entities;

import com.dev.backend.constant.enums.KieuDuLieuCauHinh;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "cau_hinh_he_thong")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CauHinhHeThong {

    @Id
    @Column(name = "ma_cau_hinh", length = 100, nullable = false)
    private String maCauHinh;

    @Column(name = "gia_tri", length = 255, nullable = false)
    private String giaTri;

    @Column(name = "kieu_du_lieu", nullable = false)
    @Enumerated(EnumType.STRING)
    private KieuDuLieuCauHinh kieuDuLieu;

    @Column(name = "mo_ta", length = 255)
    private String moTa;

    @Column(name = "ngay_cap_nhat")
    private LocalDateTime ngayCapNhat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_cap_nhat_id")
    private NguoiDung nguoiCapNhat;
}