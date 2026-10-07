package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Mã hóa / giải mã khóa cổng thanh toán bằng AES-256-GCM.
 * Khóa AES = SHA-256(payment.config.secret) — đặt bằng biến môi trường PAYMENT_CONFIG_SECRET.
 * Định dạng lưu DB: "v1:" + Base64(iv[12] || ciphertext+tag).
 */
@Component
public class PaymentSecretCipher {

    private static final String PREFIX = "v1:";
    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;

    private final SecureRandom random = new SecureRandom();
    private final String secret;

    public PaymentSecretCipher(@Value("${payment.config.secret:}") String secret) {
        this.secret = secret == null ? "" : secret.trim();
    }

    public boolean isConfigured() {
        return !secret.isEmpty();
    }

    public String encrypt(String plain) {
        if (plain == null) return null;
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array();
            return PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (CommonException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Không thể mã hóa khóa thanh toán", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null || stored.isBlank()) return null;
        if (!stored.startsWith(PREFIX)) {
            throw new IllegalStateException("Định dạng khóa thanh toán đã lưu không hợp lệ");
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            ByteBuffer buffer = ByteBuffer.wrap(all);
            byte[] iv = new byte[IV_LENGTH];
            buffer.get(iv);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (CommonException e) {
            throw e;
        } catch (Exception e) {
            throw new CommonException(
                    "Không giải mã được khóa payOS đã lưu (PAYMENT_CONFIG_SECRET đã bị đổi?). Vui lòng nhập lại khóa ở trang Cài đặt thanh toán.",
                    HttpStatus.CONFLICT, null);
        }
    }

    private SecretKeySpec key() throws Exception {
        if (!isConfigured()) {
            throw new CommonException(
                    "Máy chủ chưa đặt biến môi trường PAYMENT_CONFIG_SECRET nên không thể lưu/đọc khóa thanh toán",
                    HttpStatus.SERVICE_UNAVAILABLE, null);
        }
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        return new SecretKeySpec(hash, "AES");
    }
}
