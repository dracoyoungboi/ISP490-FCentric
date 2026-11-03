package com.dev.backend.dto.response.ketoan;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Một dòng thuế suất; danhMucId null = mức chung. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ThueSuatGtgtDto {
    private Integer id;
    private BigDecimal tyLe;
    private LocalDate hieuLucTu;
    private LocalDate hieuLucDen;
    private Integer danhMucId;
    private String maDanhMuc;
    private String tenDanhMuc;
    private String ghiChu;
}
