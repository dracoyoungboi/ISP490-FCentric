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
public class ShopeeConfigUpdating implements Serializable {

    @NotBlank(message = "Shopee Partner ID không được để trống")
    String partnerId;

    /**
     * Partner Key (Secret Key của Shopee Open Platform). Nếu để trống, giữ nguyên key đã lưu.
     */
    String partnerKey;

    /**
     * Shop ID của gian hàng Shopee.
     */
    String shopId;

    /**
     * Access Token (nếu có sẵn).
     */
    String accessToken;

    /**
     * Refresh Token (OAuth 2.0).
     */
    String refreshToken;

    /**
     * Thời điểm Access Token hết hạn.
     */
    Instant tokenExpiresAt;

    /**
     * Trạng thái hoạt động: 1 hoạt động, 0 tạm dừng.
     */
    Integer trangThai;
}

