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
        /** Chia theo kệ (hộp Chọn lô): bỏ trống thì tự chia (kệ của lô → kệ khác → chưa có kệ). */
        List<ViTri> viTri;

        /** Phân bổ lô không chọn kệ (máy chủ tự chia). */
        public Item(Integer loHangId, BigDecimal soLuong) {
            this(loHangId, soLuong, null);
        }
    }

    /** Số lấy ở một kệ; {@code viTriKhoId} null = hàng chưa có kệ. Tổng các kệ phải bằng số lấy từ lô. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ViTri {
        Integer viTriKhoId;
        BigDecimal soLuong;
    }
}
