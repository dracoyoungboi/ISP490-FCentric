package com.dev.backend.websocket;

import com.dev.backend.dto.response.customize.PayosPaymentLinkDto;
import com.dev.backend.i18n.DichCauDaLuu;
import com.dev.backend.i18n.NgonNgu;
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
 * Mỗi kết nối nghe đúng một đơn ghi trên vé đã soát lúc bắt tay (luồng vé: {@link VeKetNoiRealtime}).
 * Tuân thủ Quy tắc 1 (AGENTS.md): Sử dụng thư viện có sẵn (spring-boot-starter-websocket),
 * không cần thêm dependency bên ngoài, hỗ trợ 100% trình duyệt hiện đại (Chrome, Edge, Firefox, Safari).
 */
@Component
@Slf4j
public class PosWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;

    // Lưu các kết nối theo orderCode (Mỗi tab thanh toán QR subscribe theo orderCode)
    private final Map<Long, Set<WebSocketSession>> orderSessions = new ConcurrentHashMap<>();

    // Màn dùng giao diện tiếng Anh (kết nối kèm ?lang=en): câu lỗi errorMessage gửi bản tiếng Anh
    private final Set<WebSocketSession> phienTiengAnh = Collections.newSetFromMap(new ConcurrentHashMap<>());

    public PosWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // Đơn được nghe lấy từ vé đã kiểm lúc bắt tay, không đọc từ đường dẫn
        Long orderCode = KiemVeKetNoi.maDangKy(session);
        if (orderCode == null) return;
        if (NgonNgu.EN.equals(NgonNgu.tuChuoi(extractParam(session.getUri(), "lang")))) {
            phienTiengAnh.add(session);
        }
        orderSessions.computeIfAbsent(orderCode, k -> Collections.newSetFromMap(new ConcurrentHashMap<>())).add(session);
        log.info("WebSocket POS: Session {} đã đăng ký lắng nghe orderCode {}", session.getId(), orderCode);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        orderSessions.values().forEach(set -> set.remove(session));
        orderSessions.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        phienTiengAnh.remove(session);

        log.info("WebSocket POS: Session {} đã ngắt kết nối (status: {})", session.getId(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("WebSocket POS: Lỗi kết nối session {}: {}", session.getId(), exception.getMessage());
    }

    /**
     * Bắn notification kết quả thanh toán ngay lập tức (< 50ms) tới các màn hình POS đang chờ.
     */
    public void broadcastPayment(Long orderCode, PayosPaymentLinkDto dto) {
        if (dto == null || orderCode == null) return;
        Set<WebSocketSession> sessions = orderSessions.get(orderCode);
        if (sessions == null || sessions.isEmpty()) return;

        try {
            String json = objectMapper.writeValueAsString(dto);
            TextMessage message = new TextMessage(json);
            // dto mang câu lỗi tiếng Việt (câu lưu); màn tiếng Anh nhận bản đã dịch, chỉ dựng khi cần
            TextMessage[] banTiengAnh = new TextMessage[1];
            for (WebSocketSession session : sessions) {
                sendSafely(session, theoNgonNgu(session, dto, message, banTiengAnh));
            }

            log.info("WebSocket POS: Đã broadcast kết quả thanh toán orderCode {} (status: {})",
                    orderCode, dto.getTrangThai());
        } catch (Exception e) {
            log.error("WebSocket POS: Lỗi khi broadcast kết quả thanh toán orderCode {}: {}", orderCode, e.getMessage(), e);
        }
    }

    /** Bản tin cho một màn: màn tiếng Anh nhận câu lỗi đã dịch (dựng một lần, dùng lại cho các màn sau). */
    private TextMessage theoNgonNgu(WebSocketSession session, PayosPaymentLinkDto dto, TextMessage banViet, TextMessage[] banTiengAnh) {
        if (dto.getErrorMessage() == null || !phienTiengAnh.contains(session)) return banViet;
        if (banTiengAnh[0] == null) {
            String dich = DichCauDaLuu.dich(dto.getErrorMessage(), NgonNgu.EN);
            if (dich == null || dich.equals(dto.getErrorMessage())) {
                banTiengAnh[0] = banViet;
            } else {
                try {
                    // Bản sao DTO rồi ghi thẳng (không qua cây JSON): số BigDecimal, giờ... giữ y như bản tin tiếng Việt
                    PayosPaymentLinkDto banSao = dto.toBuilder().errorMessage(dich).build();
                    banTiengAnh[0] = new TextMessage(objectMapper.writeValueAsString(banSao));
                } catch (Exception e) {
                    log.warn("WebSocket POS: không dựng được bản tin tiếng Anh: {}", e.getMessage());
                    banTiengAnh[0] = banViet;
                }
            }
        }
        return banTiengAnh[0];
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

    private String extractParam(URI uri, String paramName) {
        if (uri == null || uri.getQuery() == null) return null;
        for (String pair : uri.getQuery().split("&")) {
            String[] parts = pair.split("=");
            if (parts.length == 2 && paramName.equalsIgnoreCase(parts[0])) return parts[1];
        }
        return null;
    }
}

