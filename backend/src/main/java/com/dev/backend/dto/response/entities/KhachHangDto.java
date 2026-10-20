package com.dev.backend.dto.response.entities;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
    String maSoThue;
    String nguoiLienHe;
    String soDienThoai;
    String email;
    String diaChi;
    String loaiKhachHang;
    Integer trangThai;
    Instant ngayTao;
    Instant ngayCapNhat;
}