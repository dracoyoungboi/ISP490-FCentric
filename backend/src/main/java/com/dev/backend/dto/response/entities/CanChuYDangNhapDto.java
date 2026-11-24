package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

/** Một tài khoản trong khung "Cần chú ý" ở màn Nhật ký đăng nhập (24 giờ gần nhất). */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CanChuYDangNhapDto {
    Integer nguoiDungId;
    String hoTen;
    String tenDangNhap;
    /** "nhieu_lan_sai" | "khoa_dung_mat_khau". */
    String lyDo;
    /** Số lần sai mật khẩu trong 24 giờ (cho "nhieu_lan_sai"). */
    int soLan;
}
