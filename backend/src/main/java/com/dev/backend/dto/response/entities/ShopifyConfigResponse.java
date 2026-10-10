package com.dev.backend.dto.response.entities;

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
public class ShopifyConfigResponse implements Serializable {

    Integer id;
    String maKenh;
    String tenKenh;
    String loaiKenh;
    String shopDomain;
    String apiUrl;
    String accessTokenMasked;
    boolean hasAccessToken;
    boolean hasApiSecret;
    String clientId;
    boolean hasRefreshToken;
    String refreshTokenMasked;
    Instant tokenExpiresAt;
    boolean isTokenExpired;
    Long secondsUntilExpiration;
    Integer trangThai;
    Instant ngayCapNhat;
}

