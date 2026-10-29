package com.dev.backend.services.tiktok;

import com.dev.backend.constants.TikTokShopConstants;
import com.dev.backend.utils.TikTokShopSigner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Client kết nối và thực thi các lệnh gọi REST API tới TikTok Shop Partner Open Platform (v202309).
 * Quản lý RestTemplate với timeout kết nối 5s, timeout đọc dữ liệu 15s.
 */
@Component
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TikTokShopClient {

    public static final int CONNECT_TIMEOUT_MS = 5_000;
    public static final int READ_TIMEOUT_MS = 15_000;

    RestTemplate restTemplate;
    ObjectMapper objectMapper;

    public TikTokShopClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = new ObjectMapper();
    }

    public RestTemplate getRestTemplate() {
        return restTemplate;
    }

    public ObjectMapper getObjectMapper() {
        return objectMapper;
    }

    /**
     * Tự động bổ sung các tham số hệ thống (app_key, timestamp, shop_cipher),
     * tính toán chữ ký số HMAC-SHA256 và sinh URL hoàn chỉnh đã được ký.
     */
    public String buildUrlWithSign(String baseUrl, String apiPath, Map<String, String> queryParams, String body,
                                   String appKey, String appSecret, String shopCipher) {
        if (appKey == null || appKey.isBlank()) {
            throw new IllegalArgumentException("App Key không được để trống khi gọi TikTok Shop API");
        }
        if (appSecret == null || appSecret.isBlank()) {
            throw new IllegalArgumentException("App Secret không được để trống khi tính chữ ký TikTok Shop");
        }

        Map<String, String> params = new HashMap<>();
        if (queryParams != null) {
            params.putAll(queryParams);
        }
        params.put("app_key", appKey.trim());
        params.put("timestamp", String.valueOf(Instant.now().getEpochSecond()));
        if (shopCipher != null && !shopCipher.isBlank()) {
            params.put("shop_cipher", shopCipher.trim());
        }

        String sign = TikTokShopSigner.calculateSignature(apiPath, params, body, appSecret.trim());
        params.put("sign", sign);

        StringBuilder urlBuilder = new StringBuilder(baseUrl != null ? baseUrl : TikTokShopConstants.BASE_URL);
        urlBuilder.append(apiPath).append("?");
        boolean first = true;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (!first) {
                urlBuilder.append("&");
            }
            urlBuilder.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
                    .append("=")
                    .append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
            first = false;
        }
        return urlBuilder.toString();
    }

    /**
     * Tạo HTTP Headers mang Access Token trong header x-tts-access-token theo chuẩn v202309.
     */
    public HttpHeaders createHeaders(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (accessToken != null && !accessToken.isBlank()) {
            headers.set(TikTokShopConstants.HEADER_ACCESS_TOKEN, accessToken.trim());
        }
        return headers;
    }

    /**
     * Thực thi lệnh GET có ký số và header x-tts-access-token.
     */
    public JsonNode executeGet(String fullSignedUrl, String accessToken) {
        HttpEntity<Void> entity = new HttpEntity<>(createHeaders(accessToken));
        ResponseEntity<String> response = restTemplate.exchange(fullSignedUrl, HttpMethod.GET, entity, String.class);
        try {
            return objectMapper.readTree(response.getBody());
        } catch (Exception e) {
            throw new IllegalStateException("Lỗi khi parse JSON phản hồi từ TikTok Shop: " + e.getMessage(), e);
        }
    }

    /**
     * Thực thi lệnh POST có ký số, body JSON và header x-tts-access-token.
     */
    public JsonNode executePost(String fullSignedUrl, String body, String accessToken) {
        HttpEntity<String> entity = new HttpEntity<>(body, createHeaders(accessToken));
        ResponseEntity<String> response = restTemplate.exchange(fullSignedUrl, HttpMethod.POST, entity, String.class);
        try {
            return objectMapper.readTree(response.getBody());
        } catch (Exception e) {
            throw new IllegalStateException("Lỗi khi parse JSON phản hồi từ TikTok Shop: " + e.getMessage(), e);
        }
    }
}
