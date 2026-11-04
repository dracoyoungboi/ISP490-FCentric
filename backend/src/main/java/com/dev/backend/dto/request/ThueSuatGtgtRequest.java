package com.dev.backend.dto.request;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Một dòng của bảng thuế suất khi lưu cả bảng; id null = dòng mới, danhMucId null = mức chung. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ThueSuatGtgtRequest {
    private Integer id;
    private BigDecimal tyLe;
    private LocalDate hieuLucTu;
    private LocalDate hieuLucDen;
    private Integer danhMucId;
    private String ghiChu;
}
