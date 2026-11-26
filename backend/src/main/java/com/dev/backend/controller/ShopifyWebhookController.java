package com.dev.backend.controller;

import com.dev.backend.services.shopify.ShopifyWebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

/**
 * Điểm nhận Webhook công khai từ Shopify (không dùng JWT nhân viên, xác thực bằng HMAC-SHA256 trên raw bytes giống mô hình payOS).
 * Luồng nhanh: xác thực chữ ký -> lưu idempotent vào bảng `shopify_webhook_inbox` -> trả ngay HTTP 200 OK rồi worker chạy nền xử lý sau.
 */
@RestController
@Tag(name = "Shopify event delivery")
public class ShopifyWebhookController {
    private final ShopifyWebhookService service;
    public ShopifyWebhookController(ShopifyWebhookService service) { this.service = service; }

    // Nhận sự kiện đơn hàng từ Shopify -> nạp vào hộp thư bền shopify_webhook_inbox chống mất/trùng sự kiện
    @PostMapping(ShopifyWebhookService.PATH)
    @Operation(summary = "Accept authenticated Shopify order events into a durable inbox")
    public ResponseEntity<Map<String, Boolean>> receive(@RequestBody byte[] raw,
            @RequestHeader(value = "X-Shopify-Shop-Domain", required = false) String shop,
            @RequestHeader(value = "X-Shopify-Topic", required = false) String topic,
            @RequestHeader(value = "X-Shopify-Hmac-Sha256", required = false) String signature,
            @RequestHeader(value = "X-Shopify-Webhook-Id", required = false) String deliveryId) {
        try {
            service.accept(raw, shop, topic, signature, deliveryId);
            return ResponseEntity.ok(Map.of("accepted", true));
        } catch (ResponseStatusException rejected) {
            // Chặn riêng ResponseStatusException tại đây để advice chung không biến lỗi 401/400 thành HTTP 500
            return ResponseEntity.status(rejected.getStatusCode()).body(Map.of("accepted", false));
        }
    }

    // Endpoint kiểm tra sẵn sàng webhook (chỉ trả tên dịch vụ, không lộ tên shop hay khóa bí mật)
    @GetMapping(ShopifyWebhookService.PATH)
    @Operation(summary = "Identify this webhook implementation without exposing shop or credential data")
    public Map<String, String> ready() { return Map.of("service", "fcentric-shopify-realtime-v1"); }
}
