package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LazadaConfigUpdating implements Serializable {

    @NotBlank(message = "Lazada App Key không được để trống")
    String appKey;

    /**
     * App Secret của ứng dụng Lazada Open Platform. Nếu để trống, giữ nguyên secret đã lưu trong DB.
     */
    String appSecret;

    /**
     * Access Token (nếu có sẵn). Nếu để trống, giữ nguyên token đã lưu trong DB.
     */
    String accessToken;

    /**
     * Refresh Token (OAuth 2.0). Nếu có, hệ thống sẽ tự động mã hóa AES-256-GCM trước khi lưu.
     */
    String refreshToken;

    /**
     * Thời điểm Access Token hết hạn.
     */
    Instant tokenExpiresAt;

    /**
     * 1: Đang hoạt động, 0: Tạm tắt đồng bộ
     */
    Integer trangThai;
}

