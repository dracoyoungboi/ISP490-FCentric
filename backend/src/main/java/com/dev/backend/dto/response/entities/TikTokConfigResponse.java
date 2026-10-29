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
public class TikTokConfigResponse implements Serializable {

    Integer id;
    String maKenh;
    String tenKenh;
    String loaiKenh;
    String apiUrl;
    String appKey;
    String serviceId;
    String shopCipher;
    String maKhoSan;
    String tenKhoSan;
    boolean hasAppSecret;
    boolean hasAccessToken;
    String accessTokenMasked;
    boolean hasRefreshToken;
    String refreshTokenMasked;
    Instant tokenExpiresAt;
    boolean isTokenExpired;
    Long secondsUntilExpiration;
    Integer trangThai;
    Instant ngayCapNhat;
}
