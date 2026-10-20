package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/** Cập nhật hồ sơ công ty (không gồm logo — logo cập nhật qua endpoint upload riêng). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ThongTinCongTyRequest {
    String name;
    /** Mã số thuế: trống = không có; 10 số, 10-3 số hoặc 12 số. */
    String taxCode;
    String email;
    String phone;
    String address;
}
