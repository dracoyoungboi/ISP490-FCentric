package com.dev.backend.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/** Hồ sơ công ty dùng chung (logoAsset = đường dẫn công khai của logo). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ThongTinCongTyDto {
    Integer id;
    String name;
    String logoAsset;
    String email;
    String phone;
    String address;
    Integer version;
    Instant ngayCapNhat;
}
