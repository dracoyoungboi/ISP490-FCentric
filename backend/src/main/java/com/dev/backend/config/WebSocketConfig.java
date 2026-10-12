package com.dev.backend.config;

import com.dev.backend.websocket.OutboundWebSocketHandler;
import com.dev.backend.websocket.PosWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Cấu hình WebSocket công khai cho ứng dụng bán hàng POS và phân hệ Xuất kho (Outbound).
 * Endpoints:
 * - /ws-pos: Thông báo thanh toán và tồn kho cho POS
 * - /ws-outbound: Thông báo real-time đợt nhặt hàng và đóng gói xuất kho
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PosWebSocketHandler posWebSocketHandler;
    private final OutboundWebSocketHandler outboundWebSocketHandler;

    public WebSocketConfig(PosWebSocketHandler posWebSocketHandler, OutboundWebSocketHandler outboundWebSocketHandler) {
        this.posWebSocketHandler = posWebSocketHandler;
        this.outboundWebSocketHandler = outboundWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(posWebSocketHandler, "/ws-pos")
                .setAllowedOrigins("*");
        registry.addHandler(outboundWebSocketHandler, "/ws-outbound")
                .setAllowedOrigins("*");
    }
}

