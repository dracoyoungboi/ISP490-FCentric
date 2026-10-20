package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class KhachHangCreating {
    String maKhachHang;
    String tenKhachHang;
    String maSoThue;
    String nguoiLienHe;
    String soDienThoai;
    String email;
    String diaChi;
    String loaiKhachHang;
}
