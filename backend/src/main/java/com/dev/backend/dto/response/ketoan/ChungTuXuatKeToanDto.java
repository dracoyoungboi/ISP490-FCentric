package com.dev.backend.dto.response.ketoan;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Một chứng từ trong lô xuất kế toán; trangThai da_xuat (đang khóa) hoặc da_mo_khoa. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChungTuXuatKeToanDto {
    private Integer id;
    private String loai;
    private Integer idNguon;
    private String soChungTu;
    private LocalDate ngayHachToan;
    private BigDecimal tongTien;
    private String trangThai;
    private String nguoiMoKhoa;
    private Instant moKhoaLuc;
    private String lyDoMoKhoa;
}
