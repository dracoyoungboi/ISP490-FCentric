package com.dev.backend.services.impl.payos;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.utils.PayosSignature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

/**
 * Gọi API payOS (https://payos.vn/docs/api/). Mọi lỗi mạng/HTTP được đổi thành
 * CommonException có thông điệp tiếng Việt; khóa bí mật không bao giờ được ghi log.
 */
@Slf4j
@Component
public class PayosClient {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper;
    private final String baseUrl;

    public PayosClient(ObjectMapper objectMapper,
                       @Value("${payos.api-base-url:https://api-merchant.payos.vn}") String baseUrl) {
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    /** Một dòng hàng hiển thị trên trang thanh toán payOS. */
    public record Item(String name, int quantity, long price) {
    }

    /** Kết quả trả về của payOS: code "00" = thành công. */
    public record PayosResult(int httpStatus, String code, String desc, JsonNode data) {
        public boolean ok() {
            return httpStatus >= 200 && httpStatus < 300 && "00".equals(code);
        }
    }

    public PayosResult createPaymentLink(PayosCredentials cred, long orderCode, long amount, String description,
                                         String returnUrl, String cancelUrl, long expiredAtEpochSeconds,
                                         List<Item> items) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("orderCode", orderCode);
        body.put("amount", amount);
        body.put("description", description);
        body.put("returnUrl", returnUrl);
        body.put("cancelUrl", cancelUrl);
        body.put("expiredAt", expiredAtEpochSeconds);
        ArrayNode itemNodes = body.putArray("items");
        for (Item item : items) {
            ObjectNode node = itemNodes.addObject();
            node.put("name", item.name());
            node.put("quantity", item.quantity());
            node.put("price", item.price());
        }
        body.put("signature", PayosSignature.forCreatePaymentLink(
                amount, cancelUrl, description, orderCode, returnUrl, cred.checksumKey()));
        return send(cred, "POST", "/v2/payment-requests", body);
    }

    public PayosResult getPaymentLink(PayosCredentials cred, long orderCode) {
        return send(cred, "GET", "/v2/payment-requests/" + orderCode, null);
    }

    public PayosResult cancelPaymentLink(PayosCredentials cred, long orderCode, String reason) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("cancellationReason", reason);
        return send(cred, "POST", "/v2/payment-requests/" + orderCode + "/cancel", body);
    }

    public PayosResult confirmWebhook(PayosCredentials cred, String webhookUrl) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("webhookUrl", webhookUrl);
        return send(cred, "POST", "/confirm-webhook", body);
    }

    private PayosResult send(PayosCredentials cred, String method, String path, JsonNode body) {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(20))
                .header("x-client-id", cred.clientId())
                .header("x-api-key", cred.apiKey())
                .header("Content-Type", "application/json");
        if ("POST".equals(method)) {
            builder.POST(HttpRequest.BodyPublishers.ofString(body == null ? "{}" : body.toString(), StandardCharsets.UTF_8));
        } else {
            builder.GET();
        }
        HttpResponse<String> response;
        try {
            response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unreachable(path, e);
        } catch (Exception e) {
            throw unreachable(path, e);
        }
        try {
            JsonNode json = response.body() == null || response.body().isBlank()
                    ? objectMapper.createObjectNode()
                    : objectMapper.readTree(response.body());
            String code = json.path("code").asText(null);
            String desc = json.path("desc").asText(null);
            JsonNode data = json.get("data");
            if (!"00".equals(code)) {
                log.warn("payOS {} {} -> HTTP {} code={} desc={}", method, path, response.statusCode(), code, desc);
            }
            return new PayosResult(response.statusCode(), code, desc, data);
        } catch (Exception e) {
            log.warn("payOS {} {} trả dữ liệu không đọc được (HTTP {})", method, path, response.statusCode());
            return new PayosResult(response.statusCode(), null, "Phản hồi payOS không hợp lệ (HTTP " + response.statusCode() + ")", null);
        }
    }

    private CommonException unreachable(String path, Exception e) {
        log.warn("Không kết nối được payOS ({}): {}", path, e.toString());
        return new CommonException("Không kết nối được tới payOS. Kiểm tra mạng của máy chủ rồi thử lại.",
                HttpStatus.BAD_GATEWAY, null);
    }
}
