package com.dev.backend.constant.variables;

import java.util.Set;

public interface IRoleType {
    String
            all = "all",
            quan_tri_vien = "quan_tri_vien",
            quan_ly_kho = "quan_ly_kho",
            nhan_vien_kho = "nhan_vien_kho",
            nhan_vien_ban_hang = "nhan_vien_ban_hang",
            nhan_vien_mua_hang = "nhan_vien_mua_hang";

    /**
     * Vai trò nhân sự: những vai trò duy nhất được gán cho người dùng và được đăng nhập.
     * Cùng danh sách với ENUM nguoi_dung.vai_tro và frontend/src/constants/backend/role.js.
     * "all" không phải vai trò, chỉ dùng trong @RequireAuth. Khách hàng không phải người dùng hệ thống
     * (quản lý ở bảng khach_hang), nên không có ở đây.
     */
    Set<String> NOI_BO = Set.of(quan_tri_vien, quan_ly_kho, nhan_vien_kho, nhan_vien_ban_hang, nhan_vien_mua_hang);

    /** Vai trò có thuộc {@link #NOI_BO} không. Nhận cả null (Set.of không cho hỏi null). */
    static boolean laNoiBo(String vaiTro) {
        return vaiTro != null && NOI_BO.contains(vaiTro);
    }
}
