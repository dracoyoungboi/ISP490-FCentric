package com.dev.backend.services.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Đường dẫn trong email, dựng từ {@code app.email-url} bằng UriComponentsBuilder (không ghép chuỗi tay).
 * Khóa riêng, không dùng {@code app.frontend-url}: backend chạy trên máy cá nhân dùng chung CSDL và hộp thư gửi với
 * production, email vẫn tới người thật nên liên kết phải trỏ trang thật (payOS vẫn quay về {@code app.frontend-url}).
 * Email trong đường dẫn Cổng nhà cung cấp được mã hóa đủ ("@" thành %40, "+" thành %2B) để
 * {@code searchParams.get('email')} ở trang đăng nhập nhà cung cấp đọc đúng.
 */
@Slf4j
@Component
public class DuongDanEmail {

    static final String MAC_DINH = "https://fcentric.net";
    static final String DANG_NHAP = "/login";
    static final String DAT_MAT_KHAU = "/set-password";
    static final String CONG_NHA_CUNG_CAP = "/supplier/login";

    private final String goc;

    public DuongDanEmail(@Value("${app.email-url:" + MAC_DINH + "}") String emailUrl) {
        String url = emailUrl == null || emailUrl.isBlank() ? MAC_DINH : emailUrl.trim();
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        this.goc = url;
    }

    /** Lúc khởi động: trỏ máy cục bộ thì người nhận email (ở máy khác) không mở được liên kết nào. */
    @EventListener(ApplicationReadyEvent.class)
    public void canhBaoNeuSaiMoiTruong() {
        if (laMayCucBo()) {
            log.warn("app.email-url đang trỏ máy cục bộ ({}): liên kết trong email chỉ mở được trên chính máy này", goc);
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

    /**
     * "https://fcentric.net/set-password#t=abc…". Mã nằm sau "#": trình duyệt không gửi phần này lên máy chủ nên mã không
     * vào nhật ký truy cập hay header Referer. Mã base64url (A–Z a–z 0–9 - _) không cần mã hóa thêm.
     */
    public String datMatKhau(String ma) {
        return UriComponentsBuilder.fromUriString(goc).path(DAT_MAT_KHAU).fragment("t=" + ma).build().toUriString();
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
