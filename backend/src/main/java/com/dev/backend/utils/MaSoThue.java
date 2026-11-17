package com.dev.backend.utils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Mã số thuế Việt Nam. Cùng luật với giao diện (frontend validations/maSoThue.js); sửa một bên thì sửa cả bên kia.
 * <ul>
 *   <li>Doanh nghiệp, tổ chức: 10 chữ số; chữ số thứ 10 là số kiểm tra của 9 chữ số đầu
 *       (trọng số 31, 29, 23, 19, 17, 13, 7, 5, 3; số kiểm tra = 10 − tổng mod 11).</li>
 *   <li>Đơn vị phụ thuộc (chi nhánh): 10 chữ số của đơn vị chủ quản + "-" + 3 chữ số từ 001 đến 999.</li>
 *   <li>Cá nhân, hộ kinh doanh: số định danh 12 chữ số; 3 số đầu là mã tỉnh nơi đăng ký khai sinh (001–096).</li>
 * </ul>
 */
public final class MaSoThue {

    /** Đúng dạng (chưa xét số kiểm tra). */
    public static final Pattern DANG = Pattern.compile("^(\\d{10})(-(\\d{3}))?$|^(\\d{12})$");
    private static final int[] TRONG_SO = {31, 29, 23, 19, 17, 13, 7, 5, 3};
    private static final int MA_TINH_TOI_DA = 96;

    private MaSoThue() {
    }

    /** Đúng dạng 10 số, 10 số + "-3 số" hoặc 12 số. */
    public static boolean dungDang(String maSoThue) {
        return maSoThue != null && DANG.matcher(maSoThue).matches();
    }

    /** Đúng dạng và đúng số kiểm tra / hậu tố / mã tỉnh. */
    public static boolean hopLe(String maSoThue) {
        if (maSoThue == null) return false;
        Matcher m = DANG.matcher(maSoThue);
        if (!m.matches()) return false;
        if (m.group(4) != null) {
            int maTinh = Integer.parseInt(m.group(4).substring(0, 3));
            return maTinh >= 1 && maTinh <= MA_TINH_TOI_DA;
        }
        if (m.group(3) != null && Integer.parseInt(m.group(3)) == 0) return false;
        return dungSoKiemTra(m.group(1));
    }

    /** Chữ số thứ 10 khớp số kiểm tra tính từ 9 chữ số đầu. */
    static boolean dungSoKiemTra(String muoiSo) {
        int tong = 0;
        for (int i = 0; i < TRONG_SO.length; i++) {
            tong += (muoiSo.charAt(i) - '0') * TRONG_SO[i];
        }
        int soKiemTra = 10 - tong % 11;
        return soKiemTra < 10 && soKiemTra == muoiSo.charAt(9) - '0';
    }
}
