package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShopifyConfigUpdating implements Serializable {

    @NotBlank(message = "Shopify Store Domain không được để trống")
    String shopDomain;

    /**
     * Admin Access Token (shpat_...). Nếu gửi null hoặc để trống, giữ nguyên token đã lưu trong DB.
     */
    String accessToken;

    /**
     * API Secret / Webhook Secret / Client Secret (tùy chọn). Nếu gửi null hoặc để trống, giữ nguyên secret đã lưu.
     */
    String apiSecret;

    /**
     * Client ID của Shopify App (OAuth 2.0).
     */
    String clientId;

    /**
     * Refresh Token (OAuth 2.0). Nếu gửi mới, hệ thống sẽ tự động mã hóa AES-256-GCM trước khi lưu DB.
     */
    String refreshToken;

    /**
     * Thời điểm Access Token hết hạn (nếu có).
     */
    java.time.Instant tokenExpiresAt;

    /**
     * 1: Đang hoạt động, 0: Tạm tắt đồng bộ
     */
    Integer trangThai;
}

