package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NguoiDungCreating {
    String tenDangNhap;
    String email;
    String hoTen;
    String soDienThoai;
    /** Mã vai trò, ví dụ nhan_vien_kho. Để trống thì là Nhân viên kho; chỉ nhận vai trò trong IRoleType.NOI_BO. */
    String vaiTro;
    String matKhau;
}
