package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;

// Bước "Xác thực OTP" của quên mật khẩu: chỉ kiểm tra mã, không đổi mật khẩu
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class VerifyResetOtpRequest {
    @NotBlank(message = "Tên đăng nhập / email không được để trống")
    String username;

    @NotBlank(message = "Mã xác nhận không được để trống")
    @Pattern(regexp = "^[0-9]{6}$", message = "Mã xác nhận gồm 6 chữ số")
    String otp;
}
