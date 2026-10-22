package com.dev.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

import java.util.function.Function;

/**
 * Kiểm cấu hình gửi email lúc khởi động. Thiếu tài khoản SMTP hoặc địa chỉ gửi thì chỉ ghi log ERROR, KHÔNG chặn
 * khởi động (không làm sập buổi demo); khi đó mọi email đều không gửi được trong khi giao diện vẫn báo thành công,
 * nên log này là dấu hiệu duy nhất. Không ghi giá trị của tài khoản hay mật khẩu vào log.
 */
@Slf4j
@Component
public class KiemTraCauHinhEmail {

    private final String host;
    private final String username;
    private final String password;
    private final String from;

    /**
     * Spring dùng: máy chủ, tài khoản, mật khẩu lấy theo bean JavaMailSender đang gửi thư thật (MailConfig viết sẵn
     * tài khoản; không có MailConfig thì Spring Boot tạo bean từ spring.mail.*), vì có MailConfig thì spring.mail.*
     * không được dùng để gửi. Không có bean dạng JavaMailSenderImpl thì kiểm theo spring.mail.*.
     */
    @Autowired
    public KiemTraCauHinhEmail(ObjectProvider<JavaMailSender> mailSender,
                               @Value("${spring.mail.host:}") String host,
                               @Value("${spring.mail.username:}") String username,
                               @Value("${spring.mail.password:}") String password,
                               @Value("${app.mail.from:}") String from) {
        this(cuaBean(mailSender, JavaMailSenderImpl::getHost, host),
                cuaBean(mailSender, JavaMailSenderImpl::getUsername, username),
                cuaBean(mailSender, JavaMailSenderImpl::getPassword, password),
                from);
    }

    /** Kiểm theo đúng các giá trị truyền vào (test). */
    public KiemTraCauHinhEmail(String host, String username, String password, String from) {
        this.host = host;
        this.username = username;
        this.password = password;
        this.from = from;
    }

    private static String cuaBean(ObjectProvider<JavaMailSender> mailSender, Function<JavaMailSenderImpl, String> lay,
                                  String macDinh) {
        JavaMailSender bean = mailSender == null ? null : mailSender.getIfAvailable();
        return bean instanceof JavaMailSenderImpl impl ? lay.apply(impl) : macDinh;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void kiemTra() {
        thieuCauHinh();
    }

    /** Trả true khi còn thiếu (đã ghi log ERROR). Tách riêng để test. */
    boolean thieuCauHinh() {
        boolean thieu = false;
        if (trong(host)) {
            log.error("Chưa cấu hình máy chủ gửi email (MAIL_HOST): mọi email sẽ không gửi được");
            thieu = true;
        }
        if (trong(username) || trong(password)) {
            log.error("Chưa cấu hình tài khoản gửi email (MAIL_USERNAME, MAIL_PASSWORD): mọi email sẽ không gửi được");
            thieu = true;
        }
        // MAIL_FROM trống thì gửi bằng địa chỉ tài khoản (EmailDispatcher.chonDiaChiGui, cuối cùng là tài khoản của bean)
        if (trong(from) && trong(username)) {
            log.error("Chưa cấu hình địa chỉ gửi email (MAIL_FROM): mọi email sẽ không gửi được");
            thieu = true;
        }
        return thieu;
    }

    private static boolean trong(String s) {
        return s == null || s.isBlank();
    }
}
