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
    String email;
    String phone;
    String address;
}
