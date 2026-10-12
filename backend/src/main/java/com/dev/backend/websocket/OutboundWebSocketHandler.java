package com.dev.backend.websocket;

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
 * Quản lý kết nối WebSocket native 2 chiều phục vụ Push Notification real-time cho phân hệ Xuất kho (Outbound).
 * Đặc biệt phục vụ màn hình Nhặt hàng (Pick UI) lắng nghe sự kiện Hủy đơn hàng và điều chỉnh số lượng cần nhặt tức thời.
 * Tuân thủ Quy tắc 1 (AGENTS.md): Sử dụng thư viện có sẵn (spring-boot-starter-websocket), không dùng thư viện ngoài.
 */
@Component
@Slf4j
public class OutboundWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;

    // Lưu các kết nối theo pickListId (Màn hình nhặt hàng subscribe theo ID phiếu nhặt)
    private final Map<Integer, Set<WebSocketSession>> pickListSessions = new ConcurrentHashMap<>();

    // Lưu các kết nối theo khoId
    private final Map<Integer, Set<WebSocketSession>> warehouseSessions = new ConcurrentHashMap<>();

    public OutboundWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Integer pickListId = extractIntParam(session.getUri(), "pickListId");
        Integer khoId = extractIntParam(session.getUri(), "khoId");

        if (pickListId != null) {
            pickListSessions.computeIfAbsent(pickListId, k -> Collections.newSetFromMap(new ConcurrentHashMap<>())).add(session);
            log.info("WebSocket Outbound: Session {} đăng ký lắng nghe pickListId {}", session.getId(), pickListId);
        }

        if (khoId != null) {
            warehouseSessions.computeIfAbsent(khoId, k -> Collections.newSetFromMap(new ConcurrentHashMap<>())).add(session);
            log.info("WebSocket Outbound: Session {} đăng ký lắng nghe khoId {}", session.getId(), khoId);
        }

        if (pickListId == null && khoId == null) {
            log.info("WebSocket Outbound: Session {} kết nối chung (broadcast)", session.getId());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        pickListSessions.values().forEach(sessions -> sessions.remove(session));
        pickListSessions.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        warehouseSessions.values().forEach(sessions -> sessions.remove(session));
        warehouseSessions.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        log.info("WebSocket Outbound: Session {} đã đóng ({})", session.getId(), status);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();
        if ("ping".equalsIgnoreCase(payload)) {
            try {
                session.sendMessage(new TextMessage("pong"));
            } catch (IOException e) {
                log.warn("Không thể gửi pong cho session {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    public void sendPickListEvent(Integer pickListId, String eventType, Map<String, Object> data) {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("eventType", eventType);
        payload.put("data", data);
        sendPickListEvent(pickListId, (Object) payload);
    }

    /**
     * Bắn thông báo Real-time tới tất cả client đang mở đợt nhặt hàng cụ thể.
     */
    public void sendPickListEvent(Integer pickListId, Object eventPayload) {
        if (pickListId == null) return;
        Set<WebSocketSession> sessions = pickListSessions.get(pickListId);
        if (sessions == null || sessions.isEmpty()) {
            log.debug("Không có WebSocket session nào đang lắng nghe pickListId {}", pickListId);
            return;
        }

        try {
            String json = objectMapper.writeValueAsString(eventPayload);
            TextMessage message = new TextMessage(json);

            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(message);
                        log.info("Đã gửi sự kiện WebSocket Outbound tới session {} cho Pick List {}", session.getId(), pickListId);
                    } catch (IOException e) {
                        log.warn("Lỗi gửi tin nhắn cho session {}: {}", session.getId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Lỗi serialize event payload cho Pick List {}: {}", pickListId, e.getMessage());
        }
    }

    private Integer extractIntParam(URI uri, String paramName) {
        if (uri == null || uri.getQuery() == null) return null;
        for (String param : uri.getQuery().split("&")) {
            String[] pair = param.split("=");
            if (pair.length == 2 && paramName.equalsIgnoreCase(pair[0])) {
                try {
                    return Integer.parseInt(pair[1]);
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }
}
