package com.dev.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.ZoneId;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {

    public static void main(String[] args) {
        // Giờ nghiệp vụ là giờ Việt Nam dù máy chủ đặt múi giờ nào (VPS chạy giờ Pacific): ngày trong số chứng từ
        // (LocalDate.now()), giờ chạy các job cron, LocalDateTime.now() — như ENV TZ của Dockerfile
        TimeZone.setDefault(TimeZone.getTimeZone(ZoneId.of("Asia/Ho_Chi_Minh")));
        SpringApplication.run(BackendApplication.class, args);
    }

}
