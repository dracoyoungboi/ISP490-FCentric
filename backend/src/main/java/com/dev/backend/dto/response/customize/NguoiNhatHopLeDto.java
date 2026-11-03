package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Một người giao nhặt được cho phiếu nhặt: nhân viên kho / quản lý kho, tài khoản đang hoạt động, có phân quyền
 * đang hiệu lực tại kho của phiếu.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NguoiNhatHopLeDto {
    Integer id;
    String hoTen;
    String tenDangNhap;
    String vaiTro;
}
