package com.dev.backend.utils;

import com.dev.backend.i18n.ThongDiep;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Họ tên người dùng (Hồ sơ của tôi, Thêm người dùng, PUT /nguoi-dung/update): chuẩn hóa cách viết rồi kiểm.
 * Cùng luật với giao diện (frontend validations/hoTen.js); sửa một bên thì sửa cả bên kia.
 * <p>
 * Chuẩn hóa (không báo lỗi): đưa dấu tiếng Việt về một dạng (NFC), bỏ ký tự vô hình, gộp khoảng trắng, cắt hai đầu.
 * Luật: bắt đầu bằng chữ cái; chỉ gồm chữ cái (có dấu), dấu cách và ' ’ . -; dài 2–100 ký tự (bằng cột ho_ten).
 * Không bắt buộc 2 từ (người một tên, người nước ngoài) và không tự viết hoa.
 */
public final class HoTen {

    public static final int DO_DAI_TOI_THIEU = 2;
    public static final int DO_DAI_TOI_DA = 100;

    // Cùng câu với giao diện (hiện dưới ô nên giữ trong một dòng). Câu tiếng Việt theo khóa: bộ xử lý lỗi chung
    // nhận ra câu (khớp nguyên văn) và dịch theo ngôn ngữ của request.
    public static final String LOI_TRONG = ThongDiep.vi("heThong.hoTenTrong");
    public static final String LOI_KY_TU = ThongDiep.vi("heThong.hoTenKyTu");
    public static final String LOI_NGAN = ThongDiep.vi("heThong.hoTenNgan", DO_DAI_TOI_THIEU);
    public static final String LOI_DAI = ThongDiep.vi("heThong.hoTenDai", DO_DAI_TOI_DA);

    // Ký tự vô hình hay dính khi dán (liệt kê tường minh như BienSoXe, không dùng \p{Cf})
    private static final Pattern VO_HINH = Pattern.compile(
            "[\\xAD\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF]");
    private static final Pattern KHOANG_TRANG = Pattern.compile("[\\s\\p{Z}]+");
    // Cắt đúng dấu cách đã gộp ở hai đầu; không dùng trim() vì trim() của Java bỏ cả ký tự điều khiển, của JS thì không
    private static final Pattern KHOANG_HAI_DAU = Pattern.compile("^ | $");
    private static final Pattern HOP_LE = Pattern.compile("^\\p{L}[\\p{L}\\p{M} '’.\\-]*$");
    // Chuỗi quá dài thì báo lỗi ngay, không chuẩn hóa (tránh tốn thời gian với chuỗi rác)
    private static final int DO_DAI_THO_TOI_DA = 1000;

    private HoTen() {
    }

    /** null → "". */
    public static String chuanHoa(String chuoi) {
        if (chuoi == null) return "";
        String s = Normalizer.normalize(chuoi, Normalizer.Form.NFC);
        s = VO_HINH.matcher(s).replaceAll("");
        s = KHOANG_TRANG.matcher(s).replaceAll(" ");
        return KHOANG_HAI_DAU.matcher(s).replaceAll("");
    }

    /** Câu báo lỗi cho người dùng, hoặc null khi hợp lệ. Nhận chuỗi chưa chuẩn hóa. */
    public static String loi(String chuoi) {
        if (chuoi != null && chuoi.length() > DO_DAI_THO_TOI_DA) return LOI_DAI;
        String s = chuanHoa(chuoi);
        if (s.isEmpty()) return LOI_TRONG;
        if (!HOP_LE.matcher(s).matches()) return LOI_KY_TU;
        // Đếm theo ký tự (code point) như cột utf8mb4, không theo đơn vị UTF-16
        int doDai = s.codePointCount(0, s.length());
        if (doDai < DO_DAI_TOI_THIEU) return LOI_NGAN;
        if (doDai > DO_DAI_TOI_DA) return LOI_DAI;
        return null;
    }
}
