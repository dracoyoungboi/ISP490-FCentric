package com.dev.backend.utils;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Biển số xe Việt Nam ở bước Xác nhận xuất của phiếu chuyển kho: chuẩn hóa cách viết và kiểm theo Thông tư
 * 79/2024/TT-BCA (Điều 37 cấu trúc biển, Điều 39 biển cũ còn lưu thông) và Phụ lục 02 Thông tư 51/2025/TT-BCA (ký hiệu
 * địa phương). Cùng luật với giao diện (frontend components/chuyen-kho/bienSoXe.js); sửa một bên thì sửa cả bên kia và
 * bộ ca thử ở hai phía.
 * <p>
 * Cách viết lưu vào phiếu: ô tô "30A-123.45" (4 số cũ "29A-1234"), xe máy "29-AB 123.45", biển tạm thời "T80-235.88".
 * Dấu ngăn được bỏ, gõ thì phải đúng chỗ. Xe máy viết có gạch sau 2 số đầu ("29-KT 123.45"); không có gạch mà khớp cả
 * hai loại thì hiểu là ô tô ("29KT12345" → "29KT-123.45").
 */
public final class BienSoXe {

    public enum Loai { O_TO, XE_MAY, TAM_THOI }

    /** Hợp lệ thì có giaTri (cách viết lưu vào phiếu) và loai; sai thì loi là câu báo người dùng. */
    public record KetQua(String giaTri, Loai loai, String loi) {
        public boolean hopLe() {
            return loi == null;
        }
    }

    /** Ký hiệu địa phương (2 số đầu) theo Phụ lục 02 Thông tư 51/2025/TT-BCA, gồm 80 của Cục CSGT. */
    public static final Set<String> MA_DIA_PHUONG = Set.of((
            "11 12 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 43 47 48 49 50 51 52 53 54 "
                    + "55 56 57 58 59 60 61 62 63 64 65 66 67 68 69 70 71 72 73 74 75 76 77 78 79 80 81 82 83 84 85 86 88 89 90 92 93 94 "
                    + "95 97 98 99").split(" "));

    // 20 chữ cái sê ri (Điều 37 khoản 5 điểm c): không có I, J, O, Q, R, W
    private static final String CHU = "[ABCDEFGHKLMNPSTUVXYZ]";
    // Chữ thứ hai sê ri xe máy: điểm d là 20 chữ trên, Phụ lục 04 mục 2.1.3 lại có R → nhận cả R
    private static final String CHU_2 = "[ABCDEFGHKLMNPRSTUVXYZ]";
    // Sê ri 2 chữ của ô tô đang cấp (điểm e) và sê ri cũ còn lưu thông (Điều 39 khoản 1, 3)
    private static final String SERI_O_TO_RIENG = "KT|RM|CD|HC|LD|DA|TĐ|MK|CT|LB|R";
    // Ô tô "30A-123.45" không có gạch sau 2 số đầu (gạch ở đó là cách viết xe máy)
    private static final String SO = "(\\d{3})[. ]?(\\d{2})|(\\d{4})";
    private static final Pattern O_TO = Pattern.compile("^(\\d{2}) ?(" + CHU + "|" + SERI_O_TO_RIENG + ")[- ]?(?:" + SO + ")$");
    private static final Pattern XE_MAY = Pattern.compile(
            "^(\\d{2})[- ]?(" + CHU + "[1-9]|" + CHU + CHU_2 + "|MĐ[1-9]|MK[1-9])[- ]?(?:" + SO + ")$");
    private static final Pattern TAM_THOI = Pattern.compile("^T ?(\\d{2})[- ]?(\\d{3})[. ]?(\\d{2})$");
    private static final Pattern MD = Pattern.compile("^(\\d{2}[- ]?)MD(?=[1-9])");

    // Các kiểu gạch đổi thành "-", ký tự vô hình bỏ đi: liệt kê tường minh, không dùng \p{Pd}, \p{Cf} vì bảng Unicode của
    // Java 17 cũ hơn của trình duyệt (ký tự mới thêm sẽ làm hai phía kết luận khác nhau)
    private static final Pattern GACH = Pattern.compile("[_\\u2010-\\u2015\\u2212\\uFE58\\uFE63\\uFF0D]");
    private static final Pattern CHAM = Pattern.compile("[,\\xB7]");
    private static final Pattern VO_HINH = Pattern.compile(
            "[\\xAD\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF]");
    // Dài hơn thế này thì chắc chắn không phải biển số: trả lỗi ngay, không chuẩn hóa (toUpperCase chậm với chuỗi dài)
    private static final int DO_DAI_TOI_DA = 64;
    private static final Pattern KHOANG_TRANG = Pattern.compile("[\\s\\p{Z}]+");
    private static final Pattern KHOANG_HAI_DAU = Pattern.compile("^ | $");
    private static final Pattern KHOANG_QUANH_DAU = Pattern.compile(" ?([-.]) ?");
    private static final Pattern HAI_SO_DAU_CO_O_I = Pattern.compile("^(?=[0-9OI]{2})(?=.?[OI])");
    private static final Pattern CHU_KHONG_DUNG = Pattern.compile("[IJOQW]");

    // Cùng câu với giao diện (hiện dưới ô nửa hộp nên giữ trong một dòng)
    private static final String LOI_MAU = "Chưa đúng mẫu, ví dụ 30A-123.45";
    public static final String LOI_TRONG = "Nhập biển số xe";

    private BienSoXe() {
    }

    public static KetQua kiemTra(String chuoi) {
        if (chuoi != null && chuoi.length() > DO_DAI_TOI_DA) return loi(LOI_MAU);
        String s = chuanHoaTho(chuoi);
        if (s.isEmpty()) return loi(LOI_TRONG);
        KetQua kq = khop(s);
        if (kq.hopLe()) return kq;
        // Gõ "MD1" thay "MĐ1" (xe máy điện, biển cũ): "MD" cũng là sê ri xe máy 2 chữ nên chỉ thử khi chuỗi gõ vào không khớp
        String thayMd = MD.matcher(s).replaceFirst("$1MĐ");
        if (!thayMd.equals(s)) {
            KetQua kqMd = khop(thayMd);
            if (kqMd.hopLe()) return kqMd;
        }
        return kq;
    }

    /** Khớp chuỗi đã chuẩn hóa; khớp cả ô tô lẫn xe máy (29KT12345, 29B11234) thì là ô tô. */
    private static KetQua khop(String s) {
        Matcher tam = TAM_THOI.matcher(s);
        if (tam.matches()) {
            return ketQua(Loai.TAM_THOI, tam.group(1), "T" + tam.group(1) + "-" + tam.group(2) + "." + tam.group(3),
                    tam.group(2) + tam.group(3));
        }
        Loai loai = Loai.O_TO;
        Matcher m = O_TO.matcher(s);
        if (!m.matches()) {
            m = XE_MAY.matcher(s);
            if (!m.matches()) return loiMau(s);
            loai = Loai.XE_MAY;
        }
        String ma = m.group(1);
        String seri = m.group(2);
        String so = m.group(5) != null ? m.group(5) : m.group(3) + "." + m.group(4);
        return ketQua(loai, ma, loai == Loai.O_TO ? ma + seri + "-" + so : ma + "-" + seri + " " + so, so);
    }

    private static KetQua ketQua(Loai loai, String ma, String giaTri, String so) {
        if (!MA_DIA_PHUONG.contains(ma)) return loi("2 số đầu \"" + ma + "\" không phải mã tỉnh");
        if (so.chars().allMatch(c -> c == '0' || c == '.')) return loi("Số thứ tự không được toàn số 0");
        return new KetQua(giaTri, loai, null);
    }

    /**
     * Viết hoa; đổi các kiểu gạch thành "-", dấu phẩy thành dấu chấm; bỏ ký tự vô hình; mỗi cụm khoảng trắng thành một
     * dấu cách (giữ ranh giới giữa sê ri và số), bỏ khoảng trắng ở hai đầu và quanh "-", ".".
     */
    private static String chuanHoaTho(String chuoi) {
        if (chuoi == null) return "";
        String s = Normalizer.normalize(chuoi, Normalizer.Form.NFC).toUpperCase(Locale.ROOT)
                .replace((char) 0xD0, 'Đ'); // Ð (Eth) gõ nhầm thay Đ
        s = GACH.matcher(s).replaceAll("-");
        s = CHAM.matcher(s).replaceAll(".");
        s = VO_HINH.matcher(s).replaceAll("");
        s = KHOANG_TRANG.matcher(s).replaceAll(" ");
        s = KHOANG_HAI_DAU.matcher(s).replaceAll("");
        return KHOANG_QUANH_DAU.matcher(s).replaceAll("$1");
    }

    private static KetQua loi(String cau) {
        return new KetQua(null, null, cau);
    }

    private static KetQua loiMau(String s) {
        if (HAI_SO_DAU_CO_O_I.matcher(s).find()) return loi("2 số đầu có chữ O/I, có thể là số 0/1");
        if (CHU_KHONG_DUNG.matcher(s).find()) return loi("Không dùng chữ I, J, O, Q, W");
        return loi(LOI_MAU);
    }
}
