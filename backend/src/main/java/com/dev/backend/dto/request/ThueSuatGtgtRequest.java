package com.dev.backend.dto.request;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Thêm / sửa một dòng thuế suất; danhMucId null = mức chung. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ThueSuatGtgtRequest {
    private BigDecimal tyLe;
    private LocalDate hieuLucTu;
    private LocalDate hieuLucDen;
    private Integer danhMucId;
    private String ghiChu;
}
