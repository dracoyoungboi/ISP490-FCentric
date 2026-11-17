package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.services.shopify.DonHangRealtime;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@Tag(name = "Order updates")
public class DonHangRealtimeController {
    private final DonHangRealtime realtime;
    public DonHangRealtimeController(DonHangRealtime realtime) { this.realtime = realtime; }

    @GetMapping(value = "/api/v1/don-ban-hang/su-kien", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_ban_hang})
    @Operation(summary = "Receive order list invalidation events without order or customer data")
    public ResponseEntity<SseEmitter> events() {
        return ResponseEntity.ok().header("Cache-Control", "no-store").header("X-Accel-Buffering", "no").body(realtime.subscribe());
    }
}
