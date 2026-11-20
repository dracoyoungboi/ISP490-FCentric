package com.dev.backend.utils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Nguồn của hồ sơ khách hàng: nơi hồ sơ được tạo, suy ra từ tiền tố mã khách.
 * Khách tự tạo từ đơn sàn mang mã KH-SHP- / KH-TTS- / KH-LZD- / KH-SP- (đặt trong OmnichannelOrderSyncJob; đổi tiền tố
 * ở đó thì đổi cả ở đây và ở frontend components/khach-hang/hienThiKhachHang.js). Còn lại là khách của cửa hàng: thêm
 * tay, thêm nhanh tại quầy POS, hoặc mã cũ.
 * Bốn tiền tố này dành riêng cho khách từ sàn: mã nhập tay và tiền tố mã tự tạo không được bắt đầu bằng chúng, để
 * nguồn không bị nhận nhầm.
 */
public final class NguonKhachHang {

    public static final String SHOPEE = "shopee";
    public static final String TIKTOK = "tiktok";
    public static final String LAZADA = "lazada";
    public static final String SHOPIFY = "shopify";
    public static final String CUA_HANG = "cua_hang";

    public static final String TIEN_TO_SHOPEE = "KH-SHP-";
    public static final String TIEN_TO_TIKTOK = "KH-TTS-";
    public static final String TIEN_TO_LAZADA = "KH-LZD-";
    public static final String TIEN_TO_SHOPIFY = "KH-SP-";

    /**
     * Điều kiện "khách cửa hàng" cho truy vấn viết tay với bí danh bảng khách là k (mã không bắt đầu bằng tiền tố sàn
     * nào). Hằng số để đặt được trong @Query; bản JPQL theo tên thuộc tính, bản SQL gốc theo tên cột.
     */
    public static final String DIEU_KIEN_CUA_HANG_JPQL = "("
            + "upper(k.maKhachHang) not like '" + TIEN_TO_SHOPEE + "%'"
            + " and upper(k.maKhachHang) not like '" + TIEN_TO_TIKTOK + "%'"
            + " and upper(k.maKhachHang) not like '" + TIEN_TO_LAZADA + "%'"
            + " and upper(k.maKhachHang) not like '" + TIEN_TO_SHOPIFY + "%')";
    public static final String DIEU_KIEN_CUA_HANG_SQL = "("
            + "upper(k.ma_khach_hang) not like '" + TIEN_TO_SHOPEE + "%'"
            + " and upper(k.ma_khach_hang) not like '" + TIEN_TO_TIKTOK + "%'"
            + " and upper(k.ma_khach_hang) not like '" + TIEN_TO_LAZADA + "%'"
            + " and upper(k.ma_khach_hang) not like '" + TIEN_TO_SHOPIFY + "%')";

    /** Tiền tố mã → nguồn. Không tiền tố nào là đầu của tiền tố khác, nên thứ tự không ảnh hưởng kết quả. */
    private static final Map<String, String> TIEN_TO = new LinkedHashMap<>();

    static {
        TIEN_TO.put(TIEN_TO_SHOPEE, SHOPEE);
        TIEN_TO.put(TIEN_TO_TIKTOK, TIKTOK);
        TIEN_TO.put(TIEN_TO_LAZADA, LAZADA);
        TIEN_TO.put(TIEN_TO_SHOPIFY, SHOPIFY);
    }

    /** Khách của cửa hàng (không phải khách do đồng bộ đơn sàn tạo). */
    public static boolean laKhachCuaHang(String ma) {
        return tienToSan(ma) == null;
    }

    private NguonKhachHang() {
    }

    /** Tiền tố sàn mà mã bắt đầu bằng (không phân biệt hoa thường), null khi không phải mã khách sàn. */
    public static String tienToSan(String ma) {
        if (ma == null) return null;
        String hoa = ma.trim().toUpperCase(Locale.ROOT);
        for (String tienTo : TIEN_TO.keySet()) {
            if (hoa.startsWith(tienTo)) return tienTo;
        }
        return null;
    }

    /** Nguồn của khách theo mã; mã không thuộc sàn nào (kể cả null) là khách cửa hàng. */
    public static String tuMa(String ma) {
        String tienTo = tienToSan(ma);
        return tienTo == null ? CUA_HANG : TIEN_TO.get(tienTo);
    }

    /** Tiền tố mã của một nguồn sàn; null với CUA_HANG hoặc giá trị lạ. */
    public static String tienToCuaNguon(String nguon) {
        for (Map.Entry<String, String> e : TIEN_TO.entrySet()) {
            if (e.getValue().equals(nguon)) return e.getKey();
        }
        return null;
    }

    /** Mọi tiền tố dành cho khách sàn. */
    public static List<String> cacTienToSan() {
        return List.copyOf(TIEN_TO.keySet());
    }

    /** Giá trị lọc nguồn hợp lệ. */
    public static boolean laNguonHopLe(String nguon) {
        return CUA_HANG.equals(nguon) || tienToCuaNguon(nguon) != null;
    }
}
