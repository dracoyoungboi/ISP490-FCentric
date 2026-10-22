package com.dev.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Thymeleaf chỉ dùng để dựng email (mẫu ở classpath {@code templates/email/}). Có bean này thì Spring Boot không tạo
 * engine mặc định; {@code spring.thymeleaf.enabled=false} tắt phần dựng trang web.
 *
 * <p>Hai resolver tạo BÊN TRONG bean (không khai báo bean ITemplateResolver riêng):
 * <ul>
 *   <li>TEXT (order 1): chỉ nhận tên kết thúc ".txt" ({@code e1-ma-dat-lai-mat-khau.txt});</li>
 *   <li>HTML (order 2): tên không đuôi, tự thêm ".html" ({@code e1-ma-dat-lai-mat-khau}).</li>
 * </ul>
 * Thiếu {@code resolvablePatterns} thì resolver HTML sẽ đi tìm "x.txt.html" cho mẫu chữ thường và báo lỗi.
 */
@Configuration
public class EmailTemplateConfig {

    /** Thư mục mẫu email trên classpath. */
    public static final String THU_MUC_MAU = "templates/email/";

    @Bean
    public SpringTemplateEngine emailTemplateEngine() {
        return taoEngine();
    }

    /** Tạo engine không cần Spring context (dùng cả trong test dựng mẫu). */
    public static SpringTemplateEngine taoEngine() {
        ClassLoaderTemplateResolver text = new ClassLoaderTemplateResolver();
        text.setPrefix(THU_MUC_MAU);
        text.setSuffix("");
        text.setResolvablePatterns(Set.of("*.txt"));
        text.setTemplateMode(TemplateMode.TEXT);
        text.setCharacterEncoding(StandardCharsets.UTF_8.name());
        text.setCacheable(true);
        text.setCheckExistence(true);
        text.setOrder(1);

        ClassLoaderTemplateResolver html = new ClassLoaderTemplateResolver();
        html.setPrefix(THU_MUC_MAU);
        html.setSuffix(".html");
        html.setTemplateMode(TemplateMode.HTML);
        html.setCharacterEncoding(StandardCharsets.UTF_8.name());
        html.setCacheable(true);
        html.setCheckExistence(true);
        html.setOrder(2);

        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.addTemplateResolver(text);
        engine.addTemplateResolver(html);
        // Không bật SpringEL compiler: dữ liệu mẫu là record nhỏ, ưu tiên đơn giản
        return engine;
    }
}
