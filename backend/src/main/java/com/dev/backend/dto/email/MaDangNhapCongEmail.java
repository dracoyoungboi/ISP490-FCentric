package com.dev.backend.dto.email;

/**
 * E5 · Mã đăng nhập Cổng nhà cung cấp (đăng nhập theo email, không theo đơn). {@link #toString()} che mã.
 *
 * @param tenNhaCungCap tên các nhà cung cấp dùng email này ("A, B, C +2"); null khi nơi gọi không truyền (mẫu ghi
 *                      "Quý công ty")
 * @param emailNhan     email đăng nhập (đã cắt khoảng trắng)
 * @param hetHanLuc     "14:27 ngày 19/10/2026"
 * @param thoiHan       "5 phút"
 */
public record MaDangNhapCongEmail(String tenNhaCungCap, String emailNhan, String ma, String hetHanLuc,
                                  String thoiHan) {
    @Override
    public String toString() {
        return "MaDangNhapCongEmail[ma=***]";
    }
}
