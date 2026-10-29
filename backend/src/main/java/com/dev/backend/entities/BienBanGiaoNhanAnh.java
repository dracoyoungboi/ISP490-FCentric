package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;

/**
 * Ảnh chụp đính kèm biên bản giao nhận (mockup B.4: ô "Ảnh chụp", không bắt buộc). Tệp nằm ở MinIO
 * (bien-ban-giao-nhan/{bienBanId}/…), thông tin tệp ở tep_tin. Thêm / xóa được khi biên bản còn chờ xử lý chênh lệch;
 * xử lý xong thì ảnh chỉ xem.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "bien_ban_giao_nhan_anh")
public class BienBanGiaoNhanAnh {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "bien_ban_id", nullable = false)
    BienBanGiaoNhan bienBan;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tep_tin_id", nullable = false)
    TepTin tepTin;

    @Size(max = 255)
    @Column(name = "mo_ta")
    String moTa;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nguoi_chup_id", nullable = false)
    NguoiDung nguoiChup;

    @NotNull
    @Column(name = "ngay_chup", nullable = false)
    Instant ngayChup;
}
