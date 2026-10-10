package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.ShopifyTestConnectionResponse;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.services.KenhBanHangService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/kenh-ban-hang")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhBanHangController {

    KenhBanHangService kenhBanHangService;

    @GetMapping("/shopify")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lấy thông tin cấu hình kênh bán Shopify (Token đã mask an toàn)")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> getShopifyConfig() {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getShopifyConfig())
                        .message("Lấy cấu hình kênh bán Shopify thành công")
                        .build()
        );
    }

    @PutMapping("/shopify")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Cập nhật cấu hình kênh bán Shopify (Mã hóa AES-256-GCM token trước khi lưu DB)")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> updateShopifyConfig(
            @Valid @RequestBody ShopifyConfigUpdating request) {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.updateShopifyConfig(request))
                        .message("Cập nhật cấu hình Shopify thành công")
                        .build()
        );
    }

    @PostMapping("/shopify/test-connection")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Kiểm tra kết nối tới Shopify Admin API với token")
    public ResponseEntity<ResponseData<ShopifyTestConnectionResponse>> testShopifyConnection(
            @RequestBody ShopifyTestConnectionRequest request) {
        ShopifyTestConnectionResponse res = kenhBanHangService.testShopifyConnection(request);
        return ResponseEntity.ok(
                ResponseData.<ShopifyTestConnectionResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(res.isConnected() ? "Kết nối Shopify thành công" : "Kiểm tra kết nối thất bại")
                        .build()
        );
    }

    @PostMapping("/shopify/refresh-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Chủ động làm mới Access Token OAuth 2.0 của Shopify bằng Refresh Token")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> refreshShopifyOAuthToken() {
        boolean success = kenhBanHangService.refreshShopifyAccessToken();
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getShopifyConfig())
                        .message(success ? "Làm mới Access Token OAuth 2.0 thành công" : "Không thể làm mới token")
                        .build()
        );
    }
}

