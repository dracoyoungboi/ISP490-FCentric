package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.Set;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class NguoiDungAuthInfo {
    Integer id;
    String tenDangNhap;
    String hoTen;
    String email;
    String soDienThoai;
    Set<String> vaiTro;  // Role chính: quan_tri_vien, quan_ly_kho, nhan_vien_kho...
    Integer trangThai;
    List<PhanQuyenNguoiDungKhoDto> phanQuyenNguoiDungKhos; // Quyền theo từng kho
    String credentialVersion; // claim "cv": dấu vân tay mật khẩu lúc phát hành token (null với token cũ)

}

