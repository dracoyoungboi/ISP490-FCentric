package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Thông tin trang Đặt mật khẩu hiện cho người mở liên kết: tài khoản nào, liên kết hết hạn lúc nào.
 * Chỉ trả cho người có mã hợp lệ (mã nằm trong email của chính tài khoản đó).
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LienKetMatKhauDto {
    String tenDangNhap;
    String hoTen;
    // để giao diện nhắc "không dùng email trong mật khẩu" như hộp Đổi mật khẩu
    String email;
    // TAO_TAI_KHOAN | CAP_LAI
    String mucDich;
    Instant hetHanLuc;
    // tài khoản đang bị khóa: vẫn đặt được mật khẩu, đăng nhập được sau khi quản trị viên mở khóa
    boolean dangKhoa;
}
