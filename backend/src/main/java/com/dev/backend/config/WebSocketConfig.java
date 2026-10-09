package com.dev.backend.config;

import com.dev.backend.websocket.PosWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Cấu hình WebSocket công khai cho ứng dụng bán hàng POS.
 * Endpoint: /ws-pos
 * Hỗ trợ native WebSocket không phụ thuộc thư viện bên ngoài.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PosWebSocketHandler posWebSocketHandler;

    public WebSocketConfig(PosWebSocketHandler posWebSocketHandler) {
        this.posWebSocketHandler = posWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(posWebSocketHandler, "/ws-pos")
                .setAllowedOrigins("*");
    }
}

