package com.dev.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NhaCungCapCreating {
    @NotBlank(message = "Mã nhà cung cấp không được để trống")
    @Size(max = 50, message = "Mã nhà cung cấp tối đa 50 ký tự")
    private String maNhaCungCap;

    @NotBlank(message = "Tên nhà cung cấp không được để trống")
    @Size(max = 200, message = "Tên nhà cung cấp tối đa 200 ký tự")
    private String tenNhaCungCap;

    @Size(max = 100, message = "Người liên hệ tối đa 100 ký tự")
    private String nguoiLienHe;

    @Size(max = 20, message = "Số điện thoại tối đa 20 ký tự")
    private String soDienThoai;

    @Email(message = "Email không hợp lệ")
    @Size(max = 100, message = "Email tối đa 100 ký tự")
    private String email;

    @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")
    private String diaChi;

    @Builder.Default
    private Integer trangThai = 1; // Mặc định hoạt động
}