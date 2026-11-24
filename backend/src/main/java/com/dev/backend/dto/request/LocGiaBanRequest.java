package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Bộ lọc màn "Tem mã vạch" (POST /san-pham-quan-ao/gia-ban/filter). Phân trang theo SẢN PHẨM:
 * {@code size} là số sản phẩm mỗi trang (10/20/50), mỗi sản phẩm kèm đủ các biến thể khớp bộ lọc.
 */
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class LocGiaBanRequest {
    @Builder.Default
    Integer page = 0;
    @Builder.Default
    Integer size = 20;
    /** Tên / mã sản phẩm, hoặc SKU / mã vạch của biến thể (không phân biệt hoa thường). */
    String tuKhoa;
    /** "tat-ca" | "doi-gia" | "chua-gia" | "thieu-ma"; trống = tất cả. Chỉ biến thể đang hoạt động. */
    String trangThai;
    /**
     * false: không đếm lại 4 tab (đổi tab, đổi trang — số đếm chỉ phụ thuộc từ khóa, giao diện giữ số cũ);
     * null / true: đếm.
     */
    Boolean kemDem;
}
