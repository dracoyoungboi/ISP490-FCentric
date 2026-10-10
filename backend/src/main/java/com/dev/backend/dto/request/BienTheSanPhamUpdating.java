package com.dev.backend.dto.request;

import com.dev.backend.entities.BienTheSanPham;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class BienTheSanPhamUpdating {
    // null = biến thể mới thêm trong form Sửa
    Integer id;
    // Màu/size: null = giữ nguyên. Chỉ đổi được khi biến thể chưa phát sinh giao dịch.
    Integer mauSacId;
    Integer sizeId;
    // Chỉ dùng cho biến thể mới; null = lấy chất liệu chung của sản phẩm.
    Integer chatLieuId;
    BigDecimal giaVon;
    BigDecimal giaBan;
    Integer trangThai;
    boolean isImageUpdated;

    public static BienTheSanPham toEntity(BienTheSanPhamUpdating updating) {
        return BienTheSanPham.builder()
                .giaVon(updating.getGiaVon())
                .giaBan(updating.getGiaBan())
                .trangThai(updating.getTrangThai())
                .build();
    }
}
