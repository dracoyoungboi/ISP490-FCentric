package com.dev.backend.dto.request;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

/** Lưu phân bổ lô cho một dòng phiếu nhặt: tổng số lượng phải bằng số cần nhặt của dòng. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class PhanBoLoNhatHangRequest {
    List<Item> phanBo;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        Integer loHangId;
        BigDecimal soLuong;
    }
}
