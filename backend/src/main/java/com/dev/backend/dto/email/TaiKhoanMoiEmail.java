package com.dev.backend.dto.email;

/**
 * E2 · Tài khoản mới. {@link #toString()} che liên kết đặt mật khẩu (ai có liên kết là đặt được mật khẩu).
 *
 * @param coDongNoiLamViec    dòng "Nơi làm việc…": mọi vai trò trừ Quản trị viên (toàn quyền mọi kho)
 * @param coDongGuiNhaCungCap dòng "Khi bạn gửi yêu cầu báo giá…": vai trò thuộc IRoleType.GUI_YEU_CAU_BAO_GIA
 * @param duongDanDatMatKhau  liên kết dùng một lần tới trang Đặt mật khẩu
 * @param hetHanLuc           hạn liên kết, dạng "14:22 ngày 20/10/2026"
 */
public record TaiKhoanMoiEmail(String hoTen, String tenDangNhap, String tenVaiTro, boolean coDongNoiLamViec,
                               boolean coDongGuiNhaCungCap, String duongDanDatMatKhau, String hetHanLuc) {
    @Override
    public String toString() {
        return "TaiKhoanMoiEmail[tenDangNhap=" + tenDangNhap + ", duongDanDatMatKhau=***]";
    }
}
