package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/** Một dòng ở màn Nhật ký đăng nhập toàn hệ thống: ai, lúc nào, kết quả, từ IP nào. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DongDangNhapHeThongDto {
    Integer id;
    Instant luc;
    Integer nguoiDungId;
    String hoTen;
    String tenDangNhap;
    /** "thanh_cong" | "sai_mat_khau" | "tai_khoan_khoa". */
    String ketQua;
    String diaChiIp;
}
