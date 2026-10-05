package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class SanPhamQuanAoBasicInfoUpdating {

    String tenSanPham;
    String moTa;
    String maVach;
    Integer danhMucId;
    Integer mucTonToiThieu;
    Integer thuongHieuId;
    // true = áp dụng thay đổi thương hiệu (null thuongHieuId = gỡ liên kết);
    // false = giữ nguyên liên kết hiện tại, bỏ qua thuongHieuId.
    boolean capNhatThuongHieu;
}