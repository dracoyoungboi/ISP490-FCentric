package com.dev.backend.utils;

import com.dev.backend.i18n.ThongDiep;

/**
 * Luật mật khẩu mới (Đổi mật khẩu, Quên mật khẩu, đặt mật khẩu qua liên kết trong email). Cùng luật với giao diện
 * (frontend utils/matKhau.js); sửa một bên thì sửa cả bên kia.
 * <p>
 * Chỉ gồm ký tự trên bàn phím tiếng Anh (chữ không dấu, số, ký tự đặc biệt), không có dấu cách, dài 8–64 ký tự, có đủ
 * chữ hoa, chữ thường, số và ký tự đặc biệt. Không nhận chữ có dấu: cùng một chữ "ệ" mỗi bộ gõ gửi một kiểu mã khác
 * nhau nên đặt trên máy này có thể không đăng nhập được trên máy khác. 64 ký tự không dấu luôn dưới 72 byte của BCrypt.
 * Chỉ áp khi đặt mật khẩu mới: đăng nhập không kiểm, mật khẩu đang dùng không bị bắt đổi. Tạm chưa chặn mật khẩu phổ
 * biến và mật khẩu chứa tên đăng nhập / email (chốt 27/11/2026).
 */
public final class MatKhau {

    public static final int DO_DAI_TOI_THIEU = 8;
    public static final int DO_DAI_TOI_DA = 64;

    private MatKhau() {
    }

    /** Lỗi đầu tiên của mật khẩu mới, hoặc null khi hợp lệ. */
    public static ThongDiep loi(String matKhau) {
        if (matKhau == null || matKhau.isBlank()) return ThongDiep.of("heThong.nhapMatKhauMoi");
        if (matKhau.codePoints().anyMatch(cp -> Character.isWhitespace(cp) || Character.isSpaceChar(cp))) {
            return ThongDiep.of("heThong.matKhauCoDauCach");
        }
        if (matKhau.codePoints().anyMatch(cp -> cp < 0x21 || cp > 0x7E)) {
            return ThongDiep.of("heThong.matKhauKyTuKhongHopLe");
        }
        if (matKhau.length() < DO_DAI_TOI_THIEU) return ThongDiep.of("heThong.matKhauMoiToiThieu", DO_DAI_TOI_THIEU);
        if (matKhau.length() > DO_DAI_TOI_DA) return ThongDiep.of("heThong.matKhauMoiToiDa", DO_DAI_TOI_DA);
        if (!duBonLoai(matKhau)) return ThongDiep.of("heThong.matKhauThieuLoaiKyTu");
        return null;
    }

    /** Có chữ hoa A–Z, chữ thường a–z, số 0–9 và ký tự đặc biệt (gọi sau khi đã chắc chỉ có ký tự in được ASCII). */
    static boolean duBonLoai(String matKhau) {
        boolean hoa = false, thuong = false, so = false, dacBiet = false;
        for (char c : matKhau.toCharArray()) {
            if (c >= 'A' && c <= 'Z') hoa = true;
            else if (c >= 'a' && c <= 'z') thuong = true;
            else if (c >= '0' && c <= '9') so = true;
            else dacBiet = true;
        }
        return hoa && thuong && so && dacBiet;
    }
}
