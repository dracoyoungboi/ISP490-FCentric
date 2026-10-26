package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Cấu hình in tem sản phẩm (cau_hinh_he_thong TEM_*) và tên cửa hàng in trên tem, cho cả nhân viên kho
 * (không đọc được GET /dieu-hanh-he-thong/cau-hinh).
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CauHinhTemDto {
    /** Khổ tem đang dùng, VD "35x22". */
    String kho;
    boolean inTenCuaHang;
    boolean inSku;
    int nguongXacNhan;
    /** Tên cửa hàng ở Thông tin cửa hàng; null nếu chưa khai báo. */
    String tenCuaHang;
}
