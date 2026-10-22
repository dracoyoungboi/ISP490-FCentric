package com.dev.backend.services;

import com.dev.backend.dto.request.LazadaConfigUpdating;
import com.dev.backend.dto.request.LazadaOAuthCallbackRequest;
import com.dev.backend.dto.request.LazadaTestConnectionRequest;
import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.customize.LazadaTestConnectionResponse;
import com.dev.backend.dto.response.customize.ShopifyTestConnectionResponse;
import com.dev.backend.dto.response.entities.LazadaConfigResponse;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;

public interface KenhBanHangService {

    /**
     * Lấy thông tin cấu hình kênh Shopify (token đã được che giấu / masked).
     */
    ShopifyConfigResponse getShopifyConfig();

    /**
     * Cập nhật thông tin cấu hình Shopify, mã hóa AES-256-GCM token trước khi lưu DB.
     */
    ShopifyConfigResponse updateShopifyConfig(ShopifyConfigUpdating request);

    /**
     * Kiểm tra kết nối tới Shopify Admin API để xác thực token trước khi lưu hoặc phục vụ kiểm tra vận hành.
     */
    ShopifyTestConnectionResponse testShopifyConnection(ShopifyTestConnectionRequest request);

    /**
     * Lấy token Admin API Shopify đã giải mã phục vụ cho các service đẩy đơn / đồng bộ kho.
     */
    String getDecryptedShopifyAccessToken();

    /**
     * Lấy URL cơ sở của Shopify Admin API (ví dụ: https://fcentric.myshopify.com/admin/api/2024-01).
     */
    String getShopifyApiUrl();

    /**
     * Chủ động làm mới Access Token OAuth 2.0 bằng Refresh Token trước khi hết hạn.
     * Áp dụng Refresh Token Rotation và cập nhật cặp token mới vào DB an toàn.
     *
     * @return true nếu làm mới thành công, false nếu không thành công hoặc không phải OAuth token
     */
    boolean refreshShopifyAccessToken();

    // ── Lazada Open Platform Integration ──

    /**
     * Lấy thông tin cấu hình kênh Lazada (Token đã được masked an toàn).
     */
    LazadaConfigResponse getLazadaConfig();

    /**
     * Cập nhật thông tin cấu hình Lazada (mã hóa AES-256-GCM App Secret và Tokens).
     */
    LazadaConfigResponse updateLazadaConfig(LazadaConfigUpdating request);

    /**
     * Kiểm tra kết nối tới Lazada Open Platform API (/seller/get).
     */
    LazadaTestConnectionResponse testLazadaConnection(LazadaTestConnectionRequest request);

    /**
     * Sinh URL ủy quyền Seller Authorization để chuyển hướng tới Lazada Seller Center.
     */
    String getLazadaAuthUrl(String redirectUri);

    /**
     * Đổi mã code nhận được từ callback OAuth2 lấy Access Token và Refresh Token.
     */
    LazadaConfigResponse exchangeLazadaToken(LazadaOAuthCallbackRequest request);

    /**
     * Làm mới Access Token Lazada bằng Refresh Token trước khi hết hạn 30 ngày.
     */
    boolean refreshLazadaAccessToken();

    /**
     * Lấy Access Token Lazada đã giải mã phục vụ đồng bộ đơn và tồn kho.
     */
    String getDecryptedLazadaAccessToken();

    /**
     * Lấy App Secret Lazada đã giải mã phục vụ ký số HMAC-SHA256.
     */
    String getDecryptedLazadaAppSecret();

    /**
     * Lấy App Key của Lazada.
     */
    String getLazadaAppKey();
}
