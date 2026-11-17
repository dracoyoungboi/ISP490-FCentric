package com.dev.backend.controller;

import com.dev.backend.services.shopify.ShopifyWebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

/** Public Shopify transport endpoint, authenticated by raw-body HMAC, not an employee JWT (same model as payOS). */
@RestController
@Tag(name = "Shopify event delivery")
public class ShopifyWebhookController {
    private final ShopifyWebhookService service;
    public ShopifyWebhookController(ShopifyWebhookService service) { this.service = service; }

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
            // The application's general exception advice otherwise turns these transport statuses into HTTP 500.
            return ResponseEntity.status(rejected.getStatusCode()).body(Map.of("accepted", false));
        }
    }

    @GetMapping(ShopifyWebhookService.PATH)
    @Operation(summary = "Identify this webhook implementation without exposing shop or credential data")
    public Map<String, String> ready() { return Map.of("service", "fcentric-shopify-realtime-v1"); }
}
