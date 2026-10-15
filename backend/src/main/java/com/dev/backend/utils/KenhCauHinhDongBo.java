package com.dev.backend.utils;

import com.dev.backend.services.multitable.DieuHanhHeThongService;

import java.util.Locale;

/**
 * Cấu hình đồng bộ theo từng kênh bán, lưu trong bảng cau_hinh_he_thong với khóa dạng
 * {@code KENH_<MA_KENH>_<TEN>} (ví dụ KENH_SHOPIFY_TU_DONG_DAY_TON).
 *
 * <p>Quy ước an toàn: khi CHƯA có dòng cấu hình (hoặc giá trị không đọc được) thì trả về đúng hành vi
 * trước khi có màn Cấu hình: tự động đẩy tồn + tự động lấy đơn đều BẬT, đẩy 100% tồn khả dụng, tồn đệm 0,
 * ngưỡng về 0 là 0. Nhờ vậy kênh đã kết nối sẵn không bị đổi cách chạy khi nâng cấp.</p>
 */
public final class KenhCauHinhDongBo {

    public static final String MA_KENH_SHOPIFY = "SHOPIFY";

    public static final String TU_DONG_DAY_TON = "TU_DONG_DAY_TON";
    public static final String TU_DONG_LAY_DON = "TU_DONG_LAY_DON";
    public static final String TY_LE_DAY_TON = "TY_LE_DAY_TON";
    public static final String TON_DEM = "TON_DEM";
    public static final String NGUONG_VE_0 = "NGUONG_VE_0";

    public static final int TY_LE_MAC_DINH = 100;
    public static final int TON_DEM_MAC_DINH = 0;
    public static final int NGUONG_VE_0_MAC_DINH = 0;
    /** Giới hạn trên cho tồn đệm / ngưỡng về 0, khớp kiểm tra ở API lưu cấu hình. */
    public static final int GIOI_HAN_SO_LUONG = 100_000;

    private KenhCauHinhDongBo() {
    }

    /** Chuẩn hóa mã kênh thành phần khóa: in hoa, ký tự ngoài A-Z/0-9 đổi thành '_'. */
    public static String chuanHoaMaKenh(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) {
            return MA_KENH_SHOPIFY;
        }
        return maKenh.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "_");
    }

    public static String khoa(String maKenh, String ten) {
        return "KENH_" + chuanHoaMaKenh(maKenh) + "_" + ten;
    }

    public static boolean tuDongDayTon(DieuHanhHeThongService cauHinh, String maKenh) {
        return docBat(cauHinh, khoa(maKenh, TU_DONG_DAY_TON));
    }

    public static boolean tuDongLayDon(DieuHanhHeThongService cauHinh, String maKenh) {
        return docBat(cauHinh, khoa(maKenh, TU_DONG_LAY_DON));
    }

    /** Tỷ lệ % tồn khả dụng được đẩy lên sàn, hợp lệ 1..100; ngoài khoảng thì dùng 100. */
    public static int tyLeDayTon(DieuHanhHeThongService cauHinh, String maKenh) {
        int giaTri = docSo(cauHinh, khoa(maKenh, TY_LE_DAY_TON), TY_LE_MAC_DINH);
        return (giaTri < 1 || giaTri > 100) ? TY_LE_MAC_DINH : giaTri;
    }

    public static int tonDem(DieuHanhHeThongService cauHinh, String maKenh) {
        return gioiHanSoLuong(docSo(cauHinh, khoa(maKenh, TON_DEM), TON_DEM_MAC_DINH), TON_DEM_MAC_DINH);
    }

    public static int nguongVe0(DieuHanhHeThongService cauHinh, String maKenh) {
        return gioiHanSoLuong(docSo(cauHinh, khoa(maKenh, NGUONG_VE_0), NGUONG_VE_0_MAC_DINH), NGUONG_VE_0_MAC_DINH);
    }

    private static int gioiHanSoLuong(int giaTri, int macDinh) {
        return (giaTri < 0 || giaTri > GIOI_HAN_SO_LUONG) ? macDinh : giaTri;
    }

    /** Chưa cấu hình = bật. Chỉ "false" hoặc "0" mới là tắt. */
    private static boolean docBat(DieuHanhHeThongService cauHinh, String khoa) {
        if (cauHinh == null) {
            return true;
        }
        String giaTri = cauHinh.getCauHinhString(khoa, null);
        if (giaTri == null || giaTri.isBlank()) {
            return true;
        }
        String t = giaTri.trim();
        return !("false".equalsIgnoreCase(t) || "0".equals(t));
    }

    private static int docSo(DieuHanhHeThongService cauHinh, String khoa, int macDinh) {
        if (cauHinh == null) {
            return macDinh;
        }
        String giaTri = cauHinh.getCauHinhString(khoa, null);
        if (giaTri == null || giaTri.isBlank()) {
            return macDinh;
        }
        try {
            return Integer.parseInt(giaTri.trim());
        } catch (NumberFormatException e) {
            return macDinh;
        }
    }
}
