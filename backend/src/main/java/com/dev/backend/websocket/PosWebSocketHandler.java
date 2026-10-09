package com.dev.backend.websocket;

import com.dev.backend.dto.response.customize.PayosPaymentLinkDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Quản lý kết nối WebSocket native 2 chiều phục vụ Push Notification real-time cho Quầy POS.
 * Tuân thủ Quy tắc 1 (AGENTS.md): Sử dụng thư viện có sẵn (spring-boot-starter-websocket),
 * không cần thêm dependency bên ngoài, hỗ trợ 100% trình duyệt hiện đại (Chrome, Edge, Firefox, Safari).
 */
@Component
@Slf4j
public class PosWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;

    // Lưu các kết nối theo orderCode (Mỗi tab thanh toán QR subscribe theo orderCode)
    private final Map<Long, Set<WebSocketSession>> orderSessions = new ConcurrentHashMap<>();

    // Lưu các kết nối theo khoId (Màn hình thu ngân lắng nghe theo kho làm việc)
    private final Map<Integer, Set<WebSocketSession>> warehouseSessions = new ConcurrentHashMap<>();

    public PosWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long orderCode = extractLongParam(session.getUri(), "orderCode");
        Integer khoId = extractIntParam(session.getUri(), "khoId");

        if (orderCode != null) {
            orderSessions.computeIfAbsent(orderCode, k -> Collections.newSetFromMap(new ConcurrentHashMap<>())).add(session);
            log.info("WebSocket POS: Session {} đã đăng ký lắng nghe orderCode {}", session.getId(), orderCode);
        }

        if (khoId != null) {
            warehouseSessions.computeIfAbsent(khoId, k -> Collections.newSetFromMap(new ConcurrentHashMap<>())).add(session);
            log.info("WebSocket POS: Session {} đã đăng ký lắng nghe khoId {}", session.getId(), khoId);
        }

        if (orderCode == null && khoId == null) {
            log.info("WebSocket POS: Session {} kết nối chung (không có filter)", session.getId());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        orderSessions.values().forEach(set -> set.remove(session));
        orderSessions.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        warehouseSessions.values().forEach(set -> set.remove(session));
        warehouseSessions.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        log.info("WebSocket POS: Session {} đã ngắt kết nối (status: {})", session.getId(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("WebSocket POS: Lỗi kết nối session {}: {}", session.getId(), exception.getMessage());
    }

    /**
     * Bắn notification kết quả thanh toán ngay lập tức (< 50ms) tới các màn hình POS đang chờ.
     */
    public void broadcastPayment(Long orderCode, Integer khoId, PayosPaymentLinkDto dto) {
        if (dto == null) return;

        try {
            String json = objectMapper.writeValueAsString(dto);
            TextMessage message = new TextMessage(json);

            // 1. Gửi cho các session đăng ký theo orderCode
            if (orderCode != null && orderSessions.containsKey(orderCode)) {
                Set<WebSocketSession> sessions = orderSessions.get(orderCode);
                for (WebSocketSession session : sessions) {
                    sendSafely(session, message);
                }
            }

            // 2. Gửi cho các session đăng ký theo khoId
            if (khoId != null && warehouseSessions.containsKey(khoId)) {
                Set<WebSocketSession> sessions = warehouseSessions.get(khoId);
                for (WebSocketSession session : sessions) {
                    sendSafely(session, message);
                }
            }

            log.info("WebSocket POS: Đã broadcast kết quả thanh toán orderCode {} (status: {})",
                    orderCode, dto.getTrangThai());
        } catch (Exception e) {
            log.error("WebSocket POS: Lỗi khi broadcast kết quả thanh toán orderCode {}: {}", orderCode, e.getMessage(), e);
        }
    }

    private void sendSafely(WebSocketSession session, TextMessage message) {
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(message);
            } catch (IOException e) {
                log.warn("WebSocket POS: Không thể gửi message tới session {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    private Long extractLongParam(URI uri, String paramName) {
        if (uri == null || uri.getQuery() == null) return null;
        for (String pair : uri.getQuery().split("&")) {
            String[] parts = pair.split("=");
            if (parts.length == 2 && paramName.equalsIgnoreCase(parts[0])) {
                try {
                    return Long.parseLong(parts[1]);
                } catch (NumberFormatException ignored) {}
            }
        }
        return null;
    }

    private Integer extractIntParam(URI uri, String paramName) {
        if (uri == null || uri.getQuery() == null) return null;
        for (String pair : uri.getQuery().split("&")) {
            String[] parts = pair.split("=");
            if (parts.length == 2 && paramName.equalsIgnoreCase(parts[0])) {
                try {
                    return Integer.parseInt(parts[1]);
                } catch (NumberFormatException ignored) {}
            }
        }
        return null;
    }
}

