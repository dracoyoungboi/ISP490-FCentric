package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@ToString
public class LoginRequest {
    @NotBlank(message = "Vui lòng nhập tên đăng nhập")
    @Size(max = 255, message = "Tên đăng nhập quá dài")
    String username;
    // không đưa mật khẩu vào toString (tránh lọt vào log)
    @ToString.Exclude
    @NotBlank(message = "Vui lòng nhập mật khẩu")
    String password;
}
