package com.dev.backend.dto.response;

/**
 * Một người đang làm việc tại kho, rút gọn cho dòng "Nhân viên tại kho" ở popup Chi tiết kho
 * (KhoTomTatResponse.nhanVien): tên, vai trò và ảnh đại diện, không kèm liên hệ.
 *
 * @param vaiTro    mã vai trò (nguoi_dung.vai_tro), giao diện tự đổi ra nhãn
 * @param avatarUrl ảnh đại diện đã chuẩn hóa HTTPS, null nếu chưa có ảnh
 */
public record NhanVienKhoTomTat(Integer id, String hoTen, String tenDangNhap, String vaiTro, String avatarUrl) {
}
