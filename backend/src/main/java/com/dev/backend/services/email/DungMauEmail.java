package com.dev.backend.services.email;

import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.dto.email.NguoiPhuTrachEmail;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.thymeleaf.ITemplateEngine;
import org.thymeleaf.context.Context;

import java.util.regex.Pattern;

/**
 * Dựng thư (HTML + chữ thường) từ mẫu Thymeleaf. Tách khỏi dispatcher để test dựng mẫu không cần SMTP.
 *
 * <p>Biến trong mẫu: {@code e} (record dữ liệu của email), {@code cuaHang}, {@code nguoiPhuTrach} (có thể null),
 * {@code tieuDe}, {@code coTraLoi} (có đặt Trả lời tới không: quyết định câu "Trả lời email này…" ở chân email).
 * Mẫu chỉ dùng th:text / th:href / th:attr (tự escape), không có th:utext.
 */
@Component
public class DungMauEmail {

    private static final Pattern KY_TU_DIEU_KHIEN = Pattern.compile("[\\p{Cntrl}\\u2028\\u2029]+");
    private static final Pattern NHIEU_DONG_TRONG = Pattern.compile("\n{3,}");
    private static final Pattern KHOANG_TRANG_CUOI_DONG = Pattern.compile("[ \\t]+\n");

    private final ITemplateEngine engine;

    public DungMauEmail(@Qualifier("emailTemplateEngine") ITemplateEngine engine) {
        this.engine = engine;
    }

    public BanThu dung(EmailGui g, CuaHangEmail cuaHang) {
        CuaHangEmail ch = cuaHang == null ? CuaHangEmail.TRONG : cuaHang;
        String tieuDe = motDong(g.tieuDe().apply(ch));
        BanThu.DiaChiTraLoi traLoi = traLoiToi(g, ch);

        Context ctx = new Context(DinhDangEmail.TIENG_VIET);
        ctx.setVariable("e", g.duLieu());
        ctx.setVariable("cuaHang", ch);
        ctx.setVariable("nguoiPhuTrach", g.nguoiPhuTrach());
        ctx.setVariable("tieuDe", tieuDe);
        ctx.setVariable("coTraLoi", traLoi != null);

        String html = engine.process(g.loai().mauHtml(), ctx);
        String text = gonChu(engine.process(g.loai().mauText(), ctx));
        return new BanThu(tieuDe, html, text, traLoi);
    }

    /**
     * Trả lời tới (chỉ email nhà cung cấp): email người phụ trách; không có thì email cửa hàng; không có cả hai thì
     * không đặt. Email nhân sự không đặt (hỗ trợ qua quản trị viên).
     */
    static BanThu.DiaChiTraLoi traLoiToi(EmailGui g, CuaHangEmail ch) {
        if (!g.loai().nhaCungCap()) {
            return null;
        }
        NguoiPhuTrachEmail npt = g.nguoiPhuTrach();
        if (npt != null && coChu(npt.email())) {
            return new BanThu.DiaChiTraLoi(npt.email().trim(), motDong(npt.hoTen()));
        }
        if (coChu(ch.email())) {
            return new BanThu.DiaChiTraLoi(ch.email().trim(), motDong(ch.tenNguoiGui()));
        }
        return null;
    }

    /** Bỏ ký tự điều khiển (\r, \n, \t…) khỏi tiêu đề, tên hiển thị: chống chèn header. */
    static String motDong(String s) {
        if (s == null) {
            return null;
        }
        return KY_TU_DIEU_KHIEN.matcher(s).replaceAll(" ").replaceAll(" {2,}", " ").trim();
    }

    /** Bản chữ thường: bỏ khoảng trắng cuối dòng, gộp nhiều dòng trống liền nhau (do các khối th:if để lại). */
    static String gonChu(String text) {
        String t = text.replace("\r\n", "\n");
        t = KHOANG_TRANG_CUOI_DONG.matcher(t).replaceAll("\n");
        t = NHIEU_DONG_TRONG.matcher(t).replaceAll("\n\n");
        return t.strip() + "\n";
    }

    private static boolean coChu(String s) {
        return s != null && !s.isBlank();
    }
}
