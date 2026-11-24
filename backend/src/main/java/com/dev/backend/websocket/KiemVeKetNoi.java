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
 * Người soát vé của kênh realtime (bước 4 trong luồng ở {@link VeKetNoiRealtime}). Chạy lúc bắt tay WebSocket, trước khi
 * kết nối mở; mỗi kênh một bản, gắn ở {@link com.dev.backend.config.WebSocketConfig}.
 * <ul>
 *   <li>Không có {@code ?ve=}, vé sai / đã dùng / hết hạn, hoặc vé xin cho kênh khác: trả 403, kết nối không mở.</li>
 *   <li>Vé hợp lệ: ghi đăng ký (kênh + mã đơn / phiếu) vào thuộc tính phiên dưới khóa {@link #DANG_KY}. Handler lấy mã từ
 *   đây qua {@link #maDangKy}, không đọc orderCode / pickListId / khoId trên đường dẫn (người dùng sửa được).</li>
 * </ul>
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
        // dung() xóa vé ngay cả khi sai kênh: vé đã đưa ra soát là hết, không thử lại ở kênh khác được
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
     * Mã được nghe của phiên (orderCode, id phiếu nhặt), dùng ở {@code afterConnectionEstablished} của handler. Phiên
     * không mang đăng ký thì đóng ngay và trả null: chỉ xảy ra nếu sau này ai đó đăng ký handler mà quên gắn lớp này —
     * chặn mặc định thay vì cho nghe.
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
