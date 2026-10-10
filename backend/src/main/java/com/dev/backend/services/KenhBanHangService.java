package com.dev.backend.services;

import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.customize.ShopifyTestConnectionResponse;
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
}

