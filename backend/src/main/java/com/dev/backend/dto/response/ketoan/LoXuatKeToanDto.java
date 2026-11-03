package com.dev.backend.dto.response.ketoan;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Một lô xuất kế toán (không kèm tệp). Thứ tự tham số khớp truy vấn chọn cột ở LoXuatKeToanRepository. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoXuatKeToanDto {
    private Integer id;
    private String soLo;
    private String hoSo;
    private LocalDate tuNgay;
    private LocalDate denNgay;
    private Boolean coTonDauKy;
    private Integer soChungTu;
    private BigDecimal tongTruocThue;
    private BigDecimal tongThue;
    private BigDecimal tongCong;
    private String tenTep;
    private Integer kichThuoc;
    private String maBam;
    private String ghiChu;
    private String nguoiTao;
    private Instant ngayTao;
}
