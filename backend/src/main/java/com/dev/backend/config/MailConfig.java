package com.dev.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

@Configuration
public class MailConfig {

    @Bean
    public JavaMailSender javaMailSender() {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost("smtp.gmail.com");
        mailSender.setPort(587);

        mailSender.setUsername("nguyenxuanphananh@gmail.com");
        mailSender.setPassword("jras olfy yaln says"); // <- App Password

        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true"); // TLS bắt buộc với port 587
        props.put("mail.debug", "false");
        props.put("mail.smtp.ssl.trust", "smtp.gmail.com"); // Rất quan trọng
        props.put("mail.smtp.ssl.protocols", "TLSv1.2");
        // Thời gian chờ SMTP (ms): mặc định JavaMail chờ vô hạn, SMTP treo sẽ treo luôn request (vd. chốt báo giá đang giữ
        // khóa dòng khi gửi email). Quá hạn thì ném lỗi, giao dịch hoàn tác như khi gửi email lỗi.
        props.put("mail.smtp.connectiontimeout", "15000");
        props.put("mail.smtp.timeout", "15000");
        props.put("mail.smtp.writetimeout", "15000");

        return mailSender;
    }

}