package com.dev.backend.controller;

import com.dev.backend.services.impl.payos.PaymentConfigService;
import com.dev.backend.services.impl.payos.PosPayosService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Webhook payOS — CÔNG KHAI (payOS gọi vào, không có token). An toàn nhờ kiểm chữ ký
 * HMAC-SHA256 bằng Checksum Key trong PosPayosService.handleWebhook.
 */
@RestController
public class PayosWebhookController {

    private final PosPayosService service;

    public PayosWebhookController(PosPayosService service) {
        this.service = service;
    }

    @PostMapping(PaymentConfigService.WEBHOOK_PATH)
    public ResponseEntity<Map<String, Object>> webhook(@RequestBody JsonNode body) {
        service.handleWebhook(body);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
