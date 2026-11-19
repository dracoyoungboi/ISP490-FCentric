package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class KhachHangCreating {
    String maKhachHang;
    String tenKhachHang;
    String soDienThoai;
    String email;
    String diaChi;
}
