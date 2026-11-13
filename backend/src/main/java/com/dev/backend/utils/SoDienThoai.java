package com.dev.backend.utils;

/**
 * Chuẩn hóa số điện thoại, dùng chung cho lưu khách hàng và ô tìm kiếm toàn hệ thống: "0912 345.678", "(091) 234-5678",
 * "+84912345678" đều về một dạng.
 */
public final class SoDienThoai {

    /** Chuỗi toàn chữ số ngắn hơn mức này không coi là số điện thoại khi tìm (BR-10): tránh quét cả bảng khách. */
    public static final int SO_CHU_SO_TOI_THIEU_KHI_TIM = 4;

    private SoDienThoai() {
    }

    /** Bỏ khoảng trắng, dấu chấm, gạch, ngoặc; "+84" đầu số đổi thành "0". Trống thì null. */
    public static String chuanHoa(String value) {
        if (value == null) {
            return null;
        }
        String gon = value.replaceAll("[\\s.()\\-]", "");
        if (gon.startsWith("+84")) {
            gon = "0" + gon.substring(3);
        }
        return gon.isEmpty() ? null : gon;
    }

    /**
     * Từ khóa có dáng số điện thoại không; có thì trả số đã chuẩn hóa để so với cột đã bỏ ký tự ngăn cách. Thêm trường
     * hợp người dùng gõ "84912345678" (không có dấu cộng, 11 chữ số) như "0912345678". Không phải số điện thoại thì null.
     */
    public static String choTimKiem(String tuKhoa) {
        String gon = chuanHoa(tuKhoa);
        if (gon == null || gon.length() < SO_CHU_SO_TOI_THIEU_KHI_TIM || !gon.chars().allMatch(Character::isDigit)) {
            return null;
        }
        if (gon.length() == 11 && gon.startsWith("84")) {
            gon = "0" + gon.substring(2);
        }
        return gon;
    }
}
