package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class ResetPasswordRequest {
    @NotBlank(message = "Tên đăng nhập / email không được để trống")
    String username;

    @NotBlank(message = "Mã xác nhận không được để trống")
    @Pattern(regexp = "^[0-9]{6}$", message = "Mã xác nhận gồm 6 chữ số")
    String otp;

    // Độ dài và loại ký tự kiểm ở NguoiDungService (utils/MatKhau), không đặt ở đây để câu lỗi dịch được
    @NotBlank(message = "Mật khẩu mới không được để trống")
    String password;
}
