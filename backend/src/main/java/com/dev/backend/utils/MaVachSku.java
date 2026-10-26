package com.dev.backend.utils;

import java.util.regex.Pattern;

/**
 * Mã vạch của biến thể (bien_the_san_pham.ma_vach_sku) — mã in trên tem CODE128 khổ 35 × 22 mm.
 * SKU dài kiểu "AK2610234-CL001-S-MS-2691" mã hóa ra khoảng 77 mm, không vừa tem, nên biến thể để trống mã vạch được
 * cấp một mã ngắn toàn chữ số: tiền tố (cấu hình MA_VACH_TIEN_TO) + id biến thể đệm 0 cho đủ {@link #DO_DAI} chữ số,
 * VD "20" + "00000150" = "2000000150" (CODE128 bộ C: 90 mô-đun, 22,5 mm với mô-đun 0,25 mm).
 * Migration Database/migration-2026-10-24-ma-vach-sku.sql điền mã cho dữ liệu cũ theo đúng quy tắc này.
 */
public final class MaVachSku {

    /** Số chữ số của mã tự sinh (tiền tố + id đệm 0); id dài hơn thì giữ nguyên đủ chữ số của id. */
    public static final int DO_DAI = 10;
    public static final String TIEN_TO_MAC_DINH = "20";
    public static final String MO_TA_TIEN_TO =
            "Tiền tố mã vạch SKU tự tạo (2 chữ số, nên dùng 20–29 là vùng mã nội bộ). Đổi tiền tố chỉ áp dụng cho mã sinh sau đó, mã đã cấp giữ nguyên";
    private static final Pattern TIEN_TO = Pattern.compile("^[0-9]{2}$");

    private MaVachSku() {
    }

    public static boolean laTienToHopLe(String tienTo) {
        return tienTo != null && TIEN_TO.matcher(tienTo).matches();
    }

    /** Tiền tố dùng để sinh mã: giá trị cấu hình nếu hợp lệ, nếu không (thiếu / bị sửa tay sai) thì tiền tố mặc định. */
    public static String tienToDung(String giaTriCauHinh) {
        String tienTo = giaTriCauHinh == null ? null : giaTriCauHinh.trim();
        return laTienToHopLe(tienTo) ? tienTo : TIEN_TO_MAC_DINH;
    }

    /** Mã tự sinh cho biến thể đã có id. */
    public static String sinh(String tienTo, int bienTheId) {
        if (bienTheId <= 0) {
            throw new IllegalArgumentException("Chỉ sinh mã vạch cho biến thể đã có id");
        }
        String tt = tienToDung(tienTo);
        String so = String.valueOf(bienTheId);
        int soChuSo0 = DO_DAI - tt.length() - so.length();
        return tt + "0".repeat(Math.max(0, soChuSo0)) + so;
    }

    /** Mã vạch người dùng nhập: bỏ khoảng trắng hai đầu; trống thì null (nhiều dòng '' sẽ vỡ ràng buộc không trùng). */
    public static String chuanHoa(String ma) {
        if (ma == null) return null;
        String gon = ma.trim();
        return gon.isEmpty() ? null : gon;
    }
}
