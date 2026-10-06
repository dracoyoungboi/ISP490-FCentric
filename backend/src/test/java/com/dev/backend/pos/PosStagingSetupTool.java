package com.dev.backend.pos;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Tool tạo hash mật khẩu cho tài khoản demo STAGING (chạy 1 lần, không phải test).
 * Cách dùng: mvnw test -Dtest=PosStagingSetupTool#genHash
 * In ra BCrypt hash của "Posdemo@123" để điền vào seed ngoài repo.
 */
public class PosStagingSetupTool {
    public static void main(String[] args) {
        System.out.println("HASH: " + new BCryptPasswordEncoder().encode(args.length > 0 ? args[0] : "Posdemo@123"));
    }

    @org.junit.jupiter.api.Test
    void genHash() {
        System.out.println("HASH: " + new BCryptPasswordEncoder().encode("Posdemo@123"));
    }
}
