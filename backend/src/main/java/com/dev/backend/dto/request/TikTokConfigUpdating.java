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
public class TikTokConfigUpdating implements Serializable {

    @NotBlank(message = "TikTok Shop App Key không được để trống")
    String appKey;

    /**
     * App Secret của ứng dụng TikTok Shop Partner Center. Nếu để trống, giữ nguyên secret đã lưu trong DB.
     */
    String appSecret;

    /**
     * Service ID (dành cho ứng dụng Partner trên TikTok Shop Partner Center).
     */
    String serviceId;

    /**
     * Mã định danh bảo mật gian hàng (shop_cipher) do TikTok cấp sau khi ủy quyền.
     */
    String shopCipher;

    /**
     * Mã kho bán hàng trên TikTok Shop được chọn để nhận số tồn.
     */
    String maKhoSan;

    /**
     * Tên kho bán hàng trên TikTok Shop.
     */
    String tenKhoSan;

    /**
     * Access Token (nếu có sẵn). Nếu để trống, giữ nguyên token đã lưu trong DB.
     */
    String accessToken;

    /**
     * Refresh Token (OAuth 2.0). Hệ thống sẽ tự động mã hóa AES-256-GCM trước khi lưu DB.
     */
    String refreshToken;

    /**
     * Thời điểm Access Token hết hạn.
     */
    Instant tokenExpiresAt;

    /**
     * 1: Đang hoạt động, 0: Tạm tắt đồng bộ.
     */
    Integer trangThai;
}
