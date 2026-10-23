package com.dev.backend.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Thông tin cửa hàng dùng chung (logoAsset = đường dẫn công khai của logo, null khi chưa có).
 * Chưa có hồ sơ thì mọi trường null.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ThongTinCongTyDto {
    Integer id;
    String name;
    /** Tên đăng ký kinh doanh (cột ten_dang_ky_kinh_doanh). */
    String legalName;
    String taxCode;
    String logoAsset;
    String email;
    String phone;
    String address;
    Integer version;
    Instant ngayCapNhat;
}
