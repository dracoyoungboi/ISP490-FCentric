package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Thêm nhanh khách hàng tại quầy POS: chỉ cần tên + số điện thoại.
 * Mã khách hàng do server sinh, loại khách mặc định là khách lẻ.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class PosQuickCustomerCreating {
    String tenKhachHang;
    String soDienThoai;
}
