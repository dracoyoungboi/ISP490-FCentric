package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Một phiên đăng nhập hiển thị ở màn "Thiết bị đang đăng nhập" (Hồ sơ cá nhân).
 * Trả về chuỗi user_agent thô để frontend tự dựng tên thân thiện ("Chrome · Windows") và chọn biểu tượng thiết bị.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhienDangNhapDto {
    Integer id;
    boolean thietBiNay;   // true = phiên của chính request đang gọi (không hiện nút Đăng xuất)
    String userAgent;
    String diaChiIp;
    String viTri;         // suy ra từ IP — để đợt sau, hiện để trống
    Instant taoLuc;
    Instant truyCapCuoi;
}
