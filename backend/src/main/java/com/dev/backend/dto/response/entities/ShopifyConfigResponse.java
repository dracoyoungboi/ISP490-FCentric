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
    /** "khoa" với Shopify (dán khóa truy cập); "uy_quyen" với sàn ủy quyền (Lazada, TikTok Shop). */
    String kieuKetNoi;
    /** chua_ket_noi | het_han | dang_hoat_dong, suy từ khóa đã lưu. Có trường này = máy chủ ngắt kết nối được. */
    String trangThaiKetNoi;

    // Các trường bổ sung cho sàn ủy quyền (Lazada, TikTok Shop)
    String appKey;
    boolean hasAppSecret;
    String tenGianHang;
    String shopIdSan;
    Instant hanUyQuyen;
    Long soNgayConUyQuyen;
    Instant ngayUyQuyen;
}
