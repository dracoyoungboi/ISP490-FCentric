package com.dev.backend.services.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Đường dẫn trong email, dựng từ {@code app.frontend-url} bằng UriComponentsBuilder (không ghép chuỗi tay).
 * Email trong đường dẫn Cổng nhà cung cấp được mã hóa đủ ("@" thành %40, "+" thành %2B) để
 * {@code searchParams.get('email')} ở trang đăng nhập nhà cung cấp đọc đúng.
 */
@Slf4j
@Component
public class DuongDanEmail {

    static final String DANG_NHAP = "/login";
    static final String CONG_NHA_CUNG_CAP = "/supplier/login";

    private final String goc;
    private final Environment environment;

    public DuongDanEmail(@Value("${app.frontend-url:http://localhost:5173}") String frontendUrl, Environment environment) {
        String url = frontendUrl == null || frontendUrl.isBlank() ? "http://localhost:5173" : frontendUrl.trim();
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        this.goc = url;
        this.environment = environment;
    }

    /** Lúc khởi động: chạy production mà vẫn trỏ localhost thì mọi liên kết trong email đều hỏng. */
    @EventListener(ApplicationReadyEvent.class)
    public void canhBaoNeuSaiMoiTruong() {
        if (environment != null && environment.acceptsProfiles(Profiles.of("prod")) && laMayCucBo()) {
            log.warn("app.frontend-url đang trỏ máy cục bộ ({}) khi chạy production: liên kết trong email sẽ không mở được",
                    goc);
        }
    }

    boolean laMayCucBo() {
        String host = UriComponentsBuilder.fromUriString(goc).build().getHost();
        return host == null || "localhost".equalsIgnoreCase(host) || host.startsWith("127.") || "0.0.0.0".equals(host);
    }

    /** "https://fcentric.net/login". */
    public String dangNhap() {
        return UriComponentsBuilder.fromUriString(goc).path(DANG_NHAP).build().toUriString();
    }

    /** "fcentric.net/login" (chữ hiện dưới nút, bỏ scheme). */
    public String nhanDangNhap() {
        return boScheme(dangNhap());
    }

    /** "https://fcentric.net/supplier/login?id=1287&email=lan.tran%40xuongmay.vn". */
    public String congNhaCungCap(Integer donMuaHangId, String email) {
        return UriComponentsBuilder.fromUriString(goc).path(CONG_NHA_CUNG_CAP)
                .queryParam("id", "{id}")
                .queryParam("email", "{email}")
                .encode()
                .buildAndExpand(donMuaHangId, email == null ? "" : email)
                .toUriString();
    }

    /** "https://fcentric.net/supplier/login" (không kèm mã đơn, email). */
    public String congNhaCungCapGoc() {
        return UriComponentsBuilder.fromUriString(goc).path(CONG_NHA_CUNG_CAP).build().toUriString();
    }

    /** "fcentric.net/supplier/login". */
    public String nhanCongNhaCungCap() {
        return boScheme(congNhaCungCapGoc());
    }

    private static String boScheme(String url) {
        UriComponents u = UriComponentsBuilder.fromUriString(url).build();
        StringBuilder sb = new StringBuilder();
        if (u.getHost() != null) {
            sb.append(u.getHost());
        }
        if (u.getPort() > 0) {
            sb.append(':').append(u.getPort());
        }
        if (u.getPath() != null) {
            sb.append(u.getPath());
        }
        return sb.toString();
    }
}
