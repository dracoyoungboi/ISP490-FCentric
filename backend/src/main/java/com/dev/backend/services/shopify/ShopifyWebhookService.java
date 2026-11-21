package com.dev.backend.services.shopify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Set;

@Service
public class ShopifyWebhookService {
    public static final String PATH = "/api/v1/shopify/webhook";
    public static final Set<String> TOPICS = Set.of("orders/create", "orders/updated", "orders/cancelled", "orders/paid", "orders/fulfilled",
            "fulfillments/create", "fulfillments/update", "fulfillment_events/create", "refunds/create",
            "fulfillment_orders/progress_reported", "fulfillment_orders/manually_reported_progress_stopped",
            "returns/request", "returns/approve", "returns/close", "returns/update");
    private final ShopifyRealtimeConnection connection;
    private final ShopifyWebhookInbox inbox;
    private final ShopifyWebhookWorker worker;
    private final ObjectMapper mapper;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.dev.backend.services.omnichannel.OmnichannelTelemetryRecorder telemetryRecorder;

    public ShopifyWebhookService(ShopifyRealtimeConnection connection, ShopifyWebhookInbox inbox, ShopifyWebhookWorker worker, ObjectMapper mapper) {
        this.connection = connection; this.inbox = inbox; this.worker = worker; this.mapper = mapper;
    }

    public void accept(byte[] raw, String domain, String topic, String signature, String deliveryId) {
        long startNs = System.nanoTime();
        int httpStatus = 200;
        String errCategory = "NONE";
        try {
            var channel = connection.current();
            if (domain == null || !domain.equals(connection.domain(channel))) {
                httpStatus = 401; errCategory = "AUTH_EXPIRED";
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
            }
            String secret = connection.signingSecret(channel);
            if (secret == null || secret.isBlank()) {
                httpStatus = 503; errCategory = "SERVER_5XX";
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
            }
            if (raw == null || raw.length > 2_000_000 || !verify(raw, signature, secret)) {
                httpStatus = 401; errCategory = "AUTH_EXPIRED";
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
            }
            if (deliveryId == null || !deliveryId.matches("[A-Za-z0-9_-]{1,128}")) {
                httpStatus = 400; errCategory = "CLIENT_4XX";
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
            }
            if (!TOPICS.contains(topic == null ? "" : topic)) return;
            try {
                JsonNode body = mapper.readTree(raw);
                String type = "Order";
                String id = body.path("order_id").asText("");
                if (topic.startsWith("orders/")) id = body.path("id").asText("");
                else if (id.isBlank() && topic.startsWith("fulfillment_orders/")) { type = "FulfillmentOrder"; id = body.path("fulfillment_order").path("id").asText(""); }
                else if (id.isBlank() && topic.startsWith("returns/")) { type = "Return"; id = body.path("id").asText(""); }
                id = id.replaceFirst("^gid://shopify/" + type + "/", "");
                if (!id.matches("[1-9][0-9]*")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
                MessageDigest hash = MessageDigest.getInstance("SHA-256");
                hash.update((domain + "\n" + topic + "\n" + deliveryId + "\n").getBytes(StandardCharsets.UTF_8));
                String key = HexFormat.of().formatHex(hash.digest(raw));
                inbox.accept(key, domain, type, id); // Committed before acknowledgement; never acknowledge an in-memory-only task.
            } catch (ResponseStatusException failure) {
                httpStatus = failure.getStatusCode().value();
                errCategory = httpStatus >= 500 ? "SERVER_5XX" : "CLIENT_4XX";
                throw failure;
            } catch (org.springframework.dao.DataAccessException | org.springframework.transaction.TransactionException failure) {
                httpStatus = 503; errCategory = "SERVER_5XX";
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
            } catch (Exception invalid) {
                httpStatus = 400; errCategory = "CLIENT_4XX";
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
            }
            worker.kick();
        } finally {
            if (telemetryRecorder != null) {
                int latencyMs = (int) Math.max(0L, (System.nanoTime() - startNs) / 1_000_000L);
                telemetryRecorder.recordAsync(
                        "SHOPIFY",
                        "WEBHOOK_IN",
                        com.dev.backend.services.omnichannel.OmnichannelTelemetryContext.JOB_WEBHOOK_IN,
                        latencyMs,
                        httpStatus,
                        errCategory,
                        null,
                        null,
                        "NONE".equals(errCategory) ? 1 : 0);
            }
        }
    }

    static boolean verify(byte[] raw, String signature, String secret) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return MessageDigest.isEqual(hmac.doFinal(raw), Base64.getDecoder().decode(signature));
        } catch (Exception invalid) { return false; }
    }
}
