package com.dev.backend.i18n;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Locale;

/**
 * Ngôn ngữ của câu trả về: giao diện gửi header {@code Accept-Language} theo lựa chọn của người dùng ("vi" / "en").
 * Chỉ "en…" mới trả tiếng Anh; không có request (job chạy nền, email, xuất tệp) hoặc header khác đều là tiếng Việt.
 */
public final class NgonNgu {

    public static final Locale VI = Locale.forLanguageTag("vi");
    public static final Locale EN = Locale.ENGLISH;

    private NgonNgu() {
    }

    /** Ngôn ngữ của request hiện tại; ngoài request thì tiếng Việt. */
    public static Locale hienTai() {
        RequestAttributes thuocTinh = RequestContextHolder.getRequestAttributes();
        if (thuocTinh instanceof ServletRequestAttributes servlet) {
            return tuHeader(servlet.getRequest());
        }
        return VI;
    }

    public static boolean laTiengAnh() {
        return EN.equals(hienTai());
    }

    static Locale tuHeader(HttpServletRequest request) {
        if (request == null) return VI;
        String header = request.getHeader("Accept-Language");
        return tuChuoi(header);
    }

    /** "en", "en-US", "en,vi;q=0.8" → tiếng Anh; còn lại tiếng Việt. */
    public static Locale tuChuoi(String header) {
        if (header == null) return VI;
        String dau = header.trim().toLowerCase(Locale.ROOT);
        return dau.startsWith("en") ? EN : VI;
    }
}
