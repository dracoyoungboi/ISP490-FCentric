package com.dev.backend.utils;

public class MaskingUtils {

    /**
     * Che giấu số điện thoại khách hàng bảo vệ thông tin cá nhân (PII Protection - SRS 8.1.1).
     * Ví dụ: "0912345382" -> "09***382", "0987654321" -> "09***321".
     */
    public static String maskPhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }
        String clean = phone.trim();
        if (clean.length() <= 5) {
            return clean;
        }
        String prefix = clean.substring(0, 2);
        String suffix = clean.substring(clean.length() - 3);
        return prefix + "***" + suffix;
    }
}

