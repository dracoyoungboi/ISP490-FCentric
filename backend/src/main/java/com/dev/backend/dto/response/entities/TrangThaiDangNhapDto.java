package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Trạng thái đăng nhập tóm tắt của một người dùng, để danh sách người dùng gắn biểu tượng "bất thường" (PA C) mà không
 * thêm cột. Dựng từ dữ liệu sẵn có (lich_su_thay_doi). Giao diện tự suy ra "lâu không đăng nhập" từ lanDangNhapCuoi +
 * ngày tạo.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrangThaiDangNhapDto {
    Integer id;
    /** Bất thường về bảo mật: sai mật khẩu nhiều lần, hoặc nhập đúng mật khẩu khi tài khoản đang khóa (24 giờ). */
    boolean canChuY;
    /** "nhieu_lan_sai" | "khoa_dung_mat_khau" | null. */
    String lyDoChuY;
    /** Lần đăng nhập thành công gần nhất (null nếu chưa có trong 90 ngày). */
    Instant lanDangNhapCuoi;
}
