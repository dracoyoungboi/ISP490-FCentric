package com.dev.backend.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

/**
 * Chặn bắt tay WebSocket không có vé hợp lệ của đúng kênh (403). Vé hợp lệ thì gắn đăng ký vào phiên để handler biết
 * kết nối được nghe gì; handler không còn đọc orderCode / pickListId / khoId từ đường dẫn.
 */
@Slf4j
public class KiemVeKetNoi implements HandshakeInterceptor {

    /** Khóa thuộc tính phiên giữ {@link VeKetNoiRealtime.DangKy}. */
    public static final String DANG_KY = "dangKy";

    private final VeKetNoiRealtime veKetNoi;
    private final VeKetNoiRealtime.Kenh kenh;

    public KiemVeKetNoi(VeKetNoiRealtime veKetNoi, VeKetNoiRealtime.Kenh kenh) {
        this.veKetNoi = veKetNoi;
        this.kenh = kenh;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String ve = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams().getFirst("ve");
        Optional<VeKetNoiRealtime.DangKy> dangKy = veKetNoi.dung(ve).filter(d -> d.kenh() == kenh);
        if (dangKy.isEmpty()) {
            log.warn("WebSocket {}: từ chối kết nối không có vé hợp lệ", kenh);
            response.setStatusCode(HttpStatus.FORBIDDEN);
            return false;
        }
        attributes.put(DANG_KY, dangKy.get());
        return true;
    }

    /**
     * Mã được nghe của phiên (orderCode, id phiếu nhặt). Phiên không mang đăng ký (lọt qua mà không bắt tay qua lớp này)
     * thì đóng ngay và trả null.
     */
    public static Long maDangKy(WebSocketSession session) {
        if (session.getAttributes().get(DANG_KY) instanceof VeKetNoiRealtime.DangKy dangKy) {
            return dangKy.ma();
        }
        try {
            session.close(CloseStatus.POLICY_VIOLATION);
        } catch (IOException ignored) {
            // Phiên đã đóng sẵn
        }
        return null;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // Không cần làm gì sau bắt tay
    }
}
