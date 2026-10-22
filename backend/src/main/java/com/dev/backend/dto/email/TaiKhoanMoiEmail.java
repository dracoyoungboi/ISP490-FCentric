package com.dev.backend.dto.email;

/**
 * E2 · Tài khoản mới. {@link #toString()} che mật khẩu.
 *
 * @param coDongNoiLamViec    dòng "Nơi làm việc và quyền…": mọi vai trò trừ Quản trị viên (toàn quyền mọi kho)
 * @param coDongGuiNhaCungCap dòng "Khi bạn gửi yêu cầu báo giá…": vai trò thuộc IRoleType.GUI_YEU_CAU_BAO_GIA
 */
public record TaiKhoanMoiEmail(String hoTen, String tenDangNhap, String matKhauTam, String tenVaiTro,
                               boolean coDongNoiLamViec, boolean coDongGuiNhaCungCap, String duongDanDangNhap,
                               String nhanDuongDan) {
    @Override
    public String toString() {
        return "TaiKhoanMoiEmail[tenDangNhap=" + tenDangNhap + ", matKhauTam=***]";
    }
}
