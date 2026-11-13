package com.dev.backend.utils;

import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.dto.request.FilterCriteria;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Từ khóa của ô tìm kiếm toàn hệ thống và ô tìm ở trang danh sách (trường lọc ảo {@link #TRUONG}).
 *
 * <p>Trường ảo: trang danh sách gửi {@code {fieldName: "tuKhoa", operation: LIKE, value: "..."}} để tìm "chứa" trên
 * mọi trường mã của loại đó (sản phẩm: tên, mã, mã vạch, SKU, mã vạch biến thể, mã vạch NCC…); {@code EQUALS} để tìm
 * "khớp chính xác" chỉ trên các trường mã. Service tách trường này ra khỏi danh sách lọc rồi ghép điều kiện riêng của
 * mình (xem {@link #tach}).</p>
 */
public final class TuKhoaTimKiem {

    /** Tên trường lọc ảo. */
    public static final String TRUONG = "tuKhoa";
    public static final int DO_DAI_TOI_THIEU = 2;
    public static final int DO_DAI_TOI_DA = 100;
    /** Ký tự thoát trong LIKE ... ESCAPE '!' (như GiaBanBienTheService.tuKhoaLike). */
    public static final char KY_TU_THOAT = '!';

    // Tiền tố mã chứng từ: PX / PXK / PN / PO / PR / LDD / KK / BG / SO; TRF, CK: phần giữa mã phiếu chuyển. Chỉ tính khi
    // từ khóa đúng bằng tiền tố hoặc tiền tố + "-" ("PX", "PN-RET"), không bắt chữ thường bắt đầu giống tiền tố ("Polo")
    private static final Pattern TIEN_TO_MA = Pattern.compile("^(PXK?|PN|PO|PR|LDD|TRF|CK|KK|BG|SO)(-|$)", Pattern.CASE_INSENSITIVE);

    private TuKhoaTimKiem() {
    }

    /** Bỏ khoảng trắng hai đầu, cắt còn 100 ký tự; ngắn hơn 2 ký tự thì null (không tìm). */
    public static String chuanHoa(String q) {
        if (q == null) return null;
        String tk = q.strip();
        if (tk.length() > DO_DAI_TOI_DA) tk = tk.substring(0, DO_DAI_TOI_DA).strip();
        return tk.length() < DO_DAI_TOI_THIEU ? null : tk;
    }

    /** Thoát ! % _ để gõ chữ nào khớp chữ đó; đổi về chữ thường để so với lower(cột). */
    public static String thoat(String tk) {
        return tk.toLowerCase(Locale.ROOT)
                .replace(String.valueOf(KY_TU_THOAT), "" + KY_TU_THOAT + KY_TU_THOAT)
                .replace("%", KY_TU_THOAT + "%")
                .replace("_", KY_TU_THOAT + "_");
    }

    /** Mẫu LIKE: "chứa" thì bọc %, "chính xác" thì để nguyên (LIKE không có % là so bằng). */
    public static String mau(String tk, boolean chinhXac) {
        String t = thoat(tk);
        return chinhXac ? t : "%" + t + "%";
    }

    /** lower(cột) LIKE mẫu ESCAPE '!'. */
    public static Predicate like(CriteriaBuilder cb, Expression<String> cot, String mau) {
        return cb.like(cb.lower(cot), mau, KY_TU_THOAT);
    }

    /**
     * Cột số điện thoại chuẩn hóa như {@link SoDienThoai#chuanHoa}: bỏ khoảng trắng, dấu chấm, gạch, ngoặc và đổi "+84"
     * thành "0", để dữ liệu cũ lưu "0912 345 678", "(091) 234-5678", "+84912345678" vẫn khớp "0912345678".
     */
    public static Expression<String> boNganCach(CriteriaBuilder cb, Expression<String> cot) {
        Expression<String> e = cot;
        for (String kyTu : new String[]{" ", ".", "-", "(", ")"}) {
            e = cb.function("replace", String.class, e, cb.literal(kyTu), cb.literal(""));
        }
        return cb.function("replace", String.class, e, cb.literal("+84"), cb.literal("0"));
    }

    /**
     * Từ khóa có dáng mã chứng từ: không có khoảng trắng và có cả chữ cái lẫn chữ số ("PX2026", "pn-trf-12"), hoặc là
     * tiền tố mã ("PX", "LDD-"). Dãy toàn số (số điện thoại), tên sản phẩm, tên khách thì không tìm chứng từ.
     */
    public static boolean giongMaChungTu(String tk) {
        if (tk == null || tk.length() < DO_DAI_TOI_THIEU || tk.chars().anyMatch(Character::isWhitespace)) return false;
        // Mã chứng từ không có % và _; các hàm lọc chứng từ cũ dùng LIKE không thoát ký tự nên bỏ qua để "PX_1" không khớp lỏng
        if (tk.indexOf('%') >= 0 || tk.indexOf('_') >= 0) return false;
        boolean coChu = tk.chars().anyMatch(Character::isLetter);
        boolean coSo = tk.chars().anyMatch(Character::isDigit);
        return (coChu && coSo) || TIEN_TO_MA.matcher(tk).find();
    }

    /** Mức khớp của một giá trị để xếp hạng: 0 trùng hẳn, 1 bắt đầu bằng, 2 chứa, 3 không khớp (không phân biệt hoa thường). */
    public static int mucKhop(String giaTri, String tk) {
        if (giaTri == null || tk == null) return 3;
        String g = giaTri.toLowerCase(Locale.ROOT);
        String t = tk.toLowerCase(Locale.ROOT);
        if (g.equals(t)) return 0;
        if (g.startsWith(t)) return 1;
        return g.contains(t) ? 2 : 3;
    }

    /** Kết quả tách trường ảo: {@code tuKhoa} null khi không có hoặc trống; {@code conLai}: các điều kiện khác. */
    public record Tach(boolean coTruong, String tuKhoa, boolean chinhXac, List<FilterCriteria> conLai) {
    }

    /** Tách trường lọc ảo {@link #TRUONG} khỏi danh sách lọc. Nhiều dòng tuKhoa thì lấy dòng cuối. */
    public static Tach tach(List<FilterCriteria> filters) {
        if (filters == null || filters.stream().noneMatch(f -> f != null && TRUONG.equals(f.getFieldName()))) {
            return new Tach(false, null, false, filters);
        }
        List<FilterCriteria> conLai = new ArrayList<>();
        String tuKhoa = null;
        boolean chinhXac = false;
        for (FilterCriteria f : filters) {
            if (f != null && TRUONG.equals(f.getFieldName())) {
                tuKhoa = f.getValue() == null ? null : chuanHoaGiuNgan(String.valueOf(f.getValue()));
                chinhXac = f.getOperation() == FilterOperation.EQUALS;
            } else {
                conLai.add(f);
            }
        }
        return new Tach(true, tuKhoa, chinhXac, conLai);
    }

    /** Như chuanHoa nhưng giữ từ khóa 1 ký tự: ô tìm ở trang danh sách vẫn lọc khi gõ 1 ký tự như trước. */
    private static String chuanHoaGiuNgan(String q) {
        String tk = q.strip();
        if (tk.length() > DO_DAI_TOI_DA) tk = tk.substring(0, DO_DAI_TOI_DA).strip();
        return tk.isEmpty() ? null : tk;
    }
}
