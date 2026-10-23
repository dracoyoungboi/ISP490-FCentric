package com.dev.backend.constant.variables;

import java.util.Map;

/**
 * Nhãn tiếng Việt của vai trò nhân sự, chép ĐÚNG {@code frontend/src/constants/backend/role.js} (có test so khớp:
 * đổi nhãn ở role.js thì phải đổi ở đây). Dùng cho email: dòng Vai trò (E2), chức danh trong phần ký (E4, M3, M1,
 * M2).
 */
public final class TenVaiTro {

    public static final Map<String, String> NHAN = Map.of(
            IRoleType.nhan_vien_kho, "Nhân viên kho",
            IRoleType.quan_ly_kho, "Quản lý kho",
            IRoleType.nhan_vien_ban_hang, "Nhân viên bán hàng",
            IRoleType.nhan_vien_mua_hang, "Nhân viên mua hàng",
            IRoleType.quan_tri_vien, "Quản trị viên");

    private TenVaiTro() {
    }

    /** Nhãn của mã vai trò; mã không phải vai trò nhân sự (hoặc null) thì null. */
    public static String cua(String maVaiTro) {
        return maVaiTro == null ? null : NHAN.get(maVaiTro.trim());
    }
}
