package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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

    @NotBlank(message = "Mật khẩu mới không được để trống")
    @Size(min = 6, message = "Mật khẩu tối thiểu 6 ký tự")
    String password;
}
