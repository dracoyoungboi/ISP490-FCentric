package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

/**
 * DTO for {@link com.dev.backend.entities.KhachHang}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class KhachHangDto implements Serializable {
    Integer id;
    String maKhachHang;
    String tenKhachHang;
    String soDienThoai;
    String email;
    String diaChi;
    Integer trangThai;
    Instant ngayTao;
    Instant ngayCapNhat;
}