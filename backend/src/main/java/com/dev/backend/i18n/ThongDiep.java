package com.dev.backend.i18n;

import java.util.Arrays;
import java.util.Locale;
import java.util.Objects;

/**
 * Một câu thông báo theo khóa + tham số (khóa và câu ở {@code resources/i18n/thong-diep/*.properties}).
 *
 * <ul>
 *   <li>Lỗi trả về giao diện: {@code throw new CommonException(ThongDiep.of("kho.khongTimThay", id))} — exception giữ
 *       câu TIẾNG VIỆT trong getMessage() (log, test, so khớp cũ không đổi); bộ xử lý lỗi chung dịch theo ngôn ngữ
 *       của request lúc trả về.</li>
 *   <li>Câu trả thẳng trong response (không qua exception): {@link #dich(String, Object...)} — theo ngôn ngữ request.</li>
 *   <li>Câu LƯU XUỐNG DB, gửi email, ghi tệp xuất, ghi log: {@link #vi(String, Object...)} hoặc giữ nguyên chuỗi Việt.</li>
 * </ul>
 */
public final class ThongDiep {

    private final String khoa;
    private final Object[] thamSo;

    private ThongDiep(String khoa, Object[] thamSo) {
        this.khoa = Objects.requireNonNull(khoa, "khoa");
        this.thamSo = thamSo == null ? new Object[0] : thamSo.clone();
    }

    public static ThongDiep of(String khoa, Object... thamSo) {
        return new ThongDiep(khoa, thamSo);
    }

    /** Câu tiếng Việt của khóa (dùng cho dữ liệu lưu, email, log). */
    public static String vi(String khoa, Object... thamSo) {
        return BoThongDiep.dich(khoa, thamSo, NgonNgu.VI);
    }

    /** Câu theo ngôn ngữ của request hiện tại (ngoài request: tiếng Việt). */
    public static String dich(String khoa, Object... thamSo) {
        return BoThongDiep.dich(khoa, thamSo, NgonNgu.hienTai());
    }

    public String khoa() {
        return khoa;
    }

    public Object[] thamSo() {
        return thamSo.clone();
    }

    public String tiengViet() {
        return BoThongDiep.dich(khoa, thamSo, NgonNgu.VI);
    }

    public String theoNgonNgu(Locale ngonNgu) {
        return BoThongDiep.dich(khoa, thamSo, ngonNgu);
    }

    /** Chuỗi của ThongDiep là câu tiếng Việt, để ghép chuỗi / log cũ vẫn ra đúng câu. */
    @Override
    public String toString() {
        return tiengViet();
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof ThongDiep k && khoa.equals(k.khoa) && Arrays.equals(thamSo, k.thamSo);
    }

    @Override
    public int hashCode() {
        return 31 * khoa.hashCode() + Arrays.hashCode(thamSo);
    }
}
