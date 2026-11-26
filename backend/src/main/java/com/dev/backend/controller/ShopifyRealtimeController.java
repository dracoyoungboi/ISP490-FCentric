package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.services.shopify.ShopifyRealtimeRegistration;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * Controller cấu hình Webhook Realtime cho Shopify (gọi từ nút "Bật nhận thay đổi" trên Màn 7 Cài đặt kênh).
 */
@RestController
@Tag(name = "Shopify realtime setup")
public class ShopifyRealtimeController {
    private final ShopifyRealtimeRegistration registration;
    public ShopifyRealtimeController(ShopifyRealtimeRegistration registration) { this.registration = registration; }

    // Chỉ Quản trị viên: đăng ký subscription nhận webhook sự kiện đơn hàng từ Shopify về backend public
    @PostMapping("/api/v1/kenh-ban-hang/shopify/nhan-thay-doi")
    @RequireAuth(roles = IRoleType.quan_tri_vien)
    @Operation(summary = "Register signed Shopify event subscriptions against the deployed public backend")
    public ResponseData<Map<String, Object>> register() {
        Map<String, Object> result = registration.register();
        return ResponseData.<Map<String, Object>>builder().status(200).message((String) result.get("message")).data(result).build();
    }
}
