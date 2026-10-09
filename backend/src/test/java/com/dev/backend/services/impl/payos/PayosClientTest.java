package com.dev.backend.services.impl.payos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Kế hoạch: docs/test-plan-payos-xac-minh-khoa.md, mục 2.3 (C1–C3).
 * Dựng HTTP server giả trên 127.0.0.1 — không gọi payOS thật.
 */
class PayosClientTest {

    private static final PayosCredentials CRED = new PayosCredentials(
            "11111111-2222-3333-4444-555555555555", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "a".repeat(64));

    private HttpServer server;
    private PayosClient client;
    private final AtomicReference<Integer> status = new AtomicReference<>(200);
    private final AtomicReference<String> body = new AtomicReference<>("");
    private final AtomicReference<String> seenClientId = new AtomicReference<>();
    private final AtomicReference<String> seenApiKey = new AtomicReference<>();
    private final AtomicReference<String> seenPath = new AtomicReference<>();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            seenClientId.set(exchange.getRequestHeaders().getFirst("x-client-id"));
            seenApiKey.set(exchange.getRequestHeaders().getFirst("x-api-key"));
            seenPath.set(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath());
            exchange.getRequestBody().readAllBytes();
            byte[] bytes = body.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status.get(), bytes.length == 0 ? -1 : bytes.length);
            if (bytes.length > 0) exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        client = new PayosClient(new ObjectMapper(), "http://127.0.0.1:" + server.getAddress().getPort() + "/");
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void C1_docDuocSignature_vaGuiDungHeader() {
        status.set(200);
        body.set("{\"code\":\"00\",\"desc\":\"success\",\"data\":{\"orderCode\":9000000000001,\"amount\":2000},"
                + "\"signature\":\"abc123\"}");

        PayosClient.PayosResult r = client.createPaymentLink(CRED, 9_000_000_000_001L, 2000, "KTKN",
                "https://x/ok", "https://x/cancel", 1_800_000_000L, List.of(new PayosClient.Item("Kiem tra", 1, 2000)));

        assertTrue(r.ok());
        assertEquals("abc123", r.signature());
        assertEquals(2000, r.data().path("amount").asLong());
        assertEquals("POST /v2/payment-requests", seenPath.get());
        assertEquals(CRED.clientId(), seenClientId.get());
        assertEquals(CRED.apiKey(), seenApiKey.get());
    }

    @Test
    void C2_http401_bodyRong() {
        status.set(401);
        body.set("");

        PayosClient.PayosResult r = client.getPaymentLink(CRED, 1L);

        assertEquals(401, r.httpStatus());
        assertNull(r.code());
        assertNull(r.signature());
        assertFalse(r.ok());
    }

    @Test
    void C3_bodyKhongPhaiJson_khongNem() {
        status.set(200);
        body.set("<html>Bad gateway</html>");

        PayosClient.PayosResult r = assertDoesNotThrow(() -> client.getPaymentLink(CRED, 1L));

        assertNull(r.code());
        assertFalse(r.ok());
    }
}
