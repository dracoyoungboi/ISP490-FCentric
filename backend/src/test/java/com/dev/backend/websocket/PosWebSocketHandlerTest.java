package com.dev.backend.websocket;

import com.dev.backend.dto.response.customize.PayosPaymentLinkDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PosWebSocketHandlerTest {

    private PosWebSocketHandler handler;
    private ObjectMapper objectMapper;

    @Mock
    private WebSocketSession session;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        handler = new PosWebSocketHandler(objectMapper);
    }

    @Test
    void test_afterConnectionEstablished_and_broadcastPayment_orderCodeMatched() throws IOException {
        // Given: Client kết nối lắng nghe orderCode 123456
        when(session.getUri()).thenReturn(URI.create("ws://localhost:8080/ws-pos?orderCode=123456"));
        when(session.isOpen()).thenReturn(true);
        handler.afterConnectionEstablished(session);

        PayosPaymentLinkDto dto = PayosPaymentLinkDto.builder()
                .orderCode(123456L)
                .trangThai("PAID")
                .build();

        // When: Server bắn notification cho orderCode 123456
        handler.broadcastPayment(123456L, 1, dto);

        // Then: Session nhận được TextMessage chứa JSON
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, times(1)).sendMessage(captor.capture());
        String payload = captor.getValue().getPayload();
        assertTrue(payload.contains("123456"));
        assertTrue(payload.contains("PAID"));
    }

    @Test
    void test_broadcastPayment_orderCodeNotMatched_sessionDoesNotReceive() throws IOException {
        // Given: Client đăng ký orderCode 111111
        when(session.getUri()).thenReturn(URI.create("ws://localhost:8080/ws-pos?orderCode=111111"));
        handler.afterConnectionEstablished(session);

        PayosPaymentLinkDto dto = PayosPaymentLinkDto.builder()
                .orderCode(999999L)
                .trangThai("PAID")
                .build();

        // When: Server bắn notification cho orderCode khác (999999)
        handler.broadcastPayment(999999L, 2, dto);

        // Then: Session 111111 không bị spam tin nhắn
        verify(session, never()).sendMessage(any(TextMessage.class));
    }
}

