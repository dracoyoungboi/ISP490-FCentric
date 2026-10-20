package com.dev.backend.utils;

import java.util.regex.Pattern;

/**
 * Quy tắc dùng chung cho mã vạch khi kiểm đếm nhập hàng (khớp utils/maVach.js ở frontend).
 */
public final class MaVachUtils {

    /** Ký tự có thể in trên tem mã vạch: chữ không dấu, số và . _ / - */
    public static final Pattern KY_TU_MA_VACH = Pattern.compile("^[A-Za-z0-9._/-]+$");

    /** Tiền tố dành riêng cho thẻ lệnh kiểm đếm (FC-KHONG-DAT, FC-HOAN-TAC, ...). */
    public static final String TIEN_TO_THE_LENH = "FC-";

    private MaVachUtils() {
    }

    public static boolean kyTuHopLe(String ma) {
        return ma != null && KY_TU_MA_VACH.matcher(ma).matches();
    }

    public static boolean laMaTheLenh(String ma) {
        return ma != null && ma.toUpperCase().startsWith(TIEN_TO_THE_LENH);
    }

    /** Tên dạng mã GS1 theo độ dài (chỉ mã toàn số), null nếu không phải dạng GS1. */
    public static String dangGs1(String ma) {
        if (ma == null || !ma.matches("\\d+")) return null;
        return switch (ma.length()) {
            case 8 -> "EAN-8";
            case 12 -> "UPC-A";
            case 13 -> "EAN-13";
            case 14 -> "GTIN-14";
            default -> null;
        };
    }

    /** Số kiểm tra GS1 đúng hay sai; null nếu mã không phải dạng GS1. */
    public static Boolean soKiemTraGs1Dung(String ma) {
        if (dangGs1(ma) == null) return null;
        int tong = 0;
        int viTri = 0;
        for (int i = ma.length() - 2; i >= 0; i--) {
            int so = ma.charAt(i) - '0';
            tong += so * (viTri % 2 == 0 ? 3 : 1);
            viTri++;
        }
        int kiemTra = (10 - (tong % 10)) % 10;
        return kiemTra == ma.charAt(ma.length() - 1) - '0';
    }
}
