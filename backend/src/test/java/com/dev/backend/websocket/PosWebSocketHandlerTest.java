package com.dev.backend.websocket;

import com.dev.backend.dto.response.customize.PayosPaymentLinkDto;
import com.dev.backend.websocket.VeKetNoiRealtime.DangKy;
import com.dev.backend.websocket.VeKetNoiRealtime.Kenh;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PosWebSocketHandlerTest {

    private PosWebSocketHandler handler;

    @Mock
    private WebSocketSession session;

    @BeforeEach
    void setUp() {
        handler = new PosWebSocketHandler(new ObjectMapper());
    }

    /** Phiên đã qua bắt tay có vé: đơn được nghe nằm ở thuộc tính phiên. */
    private void ketNoiCoVe(long orderCode, String duongDan) {
        Map<String, Object> thuocTinh = new HashMap<>();
        thuocTinh.put(KiemVeKetNoi.DANG_KY, new DangKy(Kenh.THANH_TOAN_POS, orderCode));
        when(session.getAttributes()).thenReturn(thuocTinh);
        lenient().when(session.getUri()).thenReturn(URI.create(duongDan));
        handler.afterConnectionEstablished(session);
    }

    private static PayosPaymentLinkDto daTra(long orderCode) {
        return PayosPaymentLinkDto.builder().orderCode(orderCode).trangThai("PAID").build();
    }

    @Test
    void coVe_nhanKetQuaDungDon() throws IOException {
        ketNoiCoVe(123456L, "ws://localhost:8080/ws-pos?ve=abc");
        when(session.isOpen()).thenReturn(true);

        handler.broadcastPayment(123456L, daTra(123456L));

        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, times(1)).sendMessage(captor.capture());
        String payload = captor.getValue().getPayload();
        assertTrue(payload.contains("123456"));
        assertTrue(payload.contains("PAID"));
    }

    @Test
    void donKhac_khongNhan() throws IOException {
        ketNoiCoVe(111111L, "ws://localhost:8080/ws-pos?ve=abc");

        handler.broadcastPayment(999999L, daTra(999999L));

        verify(session, never()).sendMessage(any(TextMessage.class));
    }

    /** orderCode trên đường dẫn không còn tác dụng: chỉ vé quyết định được nghe đơn nào. */
    @Test
    void orderCodeTrenDuongDan_biBoQua() throws IOException {
        ketNoiCoVe(111111L, "ws://localhost:8080/ws-pos?ve=abc&orderCode=999999");

        handler.broadcastPayment(999999L, daTra(999999L));

        verify(session, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void khongCoDangKy_dongPhienNgay() throws IOException {
        when(session.getAttributes()).thenReturn(new HashMap<>());

        handler.afterConnectionEstablished(session);
        handler.broadcastPayment(123456L, daTra(123456L));

        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verify(session, never()).sendMessage(any(TextMessage.class));
    }
}
