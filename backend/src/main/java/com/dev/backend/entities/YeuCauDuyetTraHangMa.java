package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/** Mã PIN (đã băm) gửi cho một quản lý của một yêu cầu duyệt trả hàng. */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "yeu_cau_duyet_tra_hang_ma")
public class YeuCauDuyetTraHangMa {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "yeu_cau_duyet_tra_hang_id", nullable = false)
    Integer yeuCauDuyetTraHangId;

    @Column(name = "nguoi_dung_id", nullable = false)
    Integer nguoiDungId;

    @Column(name = "ma_bam", nullable = false, length = 100)
    String maBam;
}
