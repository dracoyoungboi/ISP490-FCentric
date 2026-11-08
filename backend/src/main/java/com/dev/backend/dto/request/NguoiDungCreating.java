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
    /**
     * Nơi làm việc: bắt buộc với vai trò làm theo kho (mọi vai trò trừ Quản trị viên), bỏ qua với Quản trị viên.
     * Gán trong cùng giao dịch tạo tài khoản, kèm mẫu quyền của vai trò (như ngăn kéo Phân quyền).
     */
    Integer khoId;
}
