package com.dev.backend.config;

import com.dev.backend.websocket.KiemVeKetNoi;
import com.dev.backend.websocket.OutboundWebSocketHandler;
import com.dev.backend.websocket.PosWebSocketHandler;
import com.dev.backend.websocket.VeKetNoiRealtime;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Kênh realtime cho POS và Xuất kho. Mỗi kết nối phải kèm vé ({@code ?ve=}) xin qua API có đăng nhập
 * ({@code /api/v1/realtime/ve/...}); vé chỉ mở đúng một đơn thanh toán hoặc một phiếu nhặt mà người xin được xem.
 * <ul>
 *   <li>{@code /ws-pos}: kết quả thanh toán chuyển khoản của một đơn POS</li>
 *   <li>{@code /ws-outbound}: đơn bị hủy khi đang nhặt / đóng gói của một phiếu nhặt</li>
 * </ul>
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PosWebSocketHandler posWebSocketHandler;
    private final OutboundWebSocketHandler outboundWebSocketHandler;
    private final VeKetNoiRealtime veKetNoi;

    public WebSocketConfig(PosWebSocketHandler posWebSocketHandler, OutboundWebSocketHandler outboundWebSocketHandler,
                           VeKetNoiRealtime veKetNoi) {
        this.posWebSocketHandler = posWebSocketHandler;
        this.outboundWebSocketHandler = outboundWebSocketHandler;
        this.veKetNoi = veKetNoi;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Origin để "*": kết nối không dựa vào cookie mà vào vé chỉ người đăng nhập xin được
        registry.addHandler(posWebSocketHandler, "/ws-pos")
                .addInterceptors(new KiemVeKetNoi(veKetNoi, VeKetNoiRealtime.Kenh.THANH_TOAN_POS))
                .setAllowedOrigins("*");
        registry.addHandler(outboundWebSocketHandler, "/ws-outbound")
                .addInterceptors(new KiemVeKetNoi(veKetNoi, VeKetNoiRealtime.Kenh.PHIEU_NHAT))
                .setAllowedOrigins("*");
    }
}
