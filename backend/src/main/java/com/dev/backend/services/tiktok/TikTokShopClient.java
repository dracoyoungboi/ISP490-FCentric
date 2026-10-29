package com.dev.backend.services.tiktok;

import com.dev.backend.constants.TikTokShopConstants;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.utils.TikTokShopSigner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
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
     * Tạo URL chuyển hướng người bán sang TikTok Shop Seller Center để ủy quyền Partner App.
     * Tự động sinh mã state ngẫu nhiên chống tấn công CSRF.
     */
    public String generateAuthUrl(String appKey, String redirectUri) {
        return generateAuthUrl(appKey, redirectUri, java.util.UUID.randomUUID().toString());
    }

    public String generateAuthUrl(String appKey, String redirectUri, String state) {
        if (appKey == null || appKey.isBlank()) {
            throw new IllegalArgumentException("App Key không được để trống khi tạo URL ủy quyền TikTok Shop");
        }
        String cleanAppKey = appKey.trim();
        String cleanState = (state != null && !state.isBlank()) ? state.trim() : java.util.UUID.randomUUID().toString();

        StringBuilder urlBuilder = new StringBuilder(TikTokShopConstants.AUTH_URL_PARTNER);
        urlBuilder.append("?service_id=").append(URLEncoder.encode(cleanAppKey, StandardCharsets.UTF_8));
        urlBuilder.append("&state=").append(URLEncoder.encode(cleanState, StandardCharsets.UTF_8));
        if (redirectUri != null && !redirectUri.isBlank() && !redirectUri.contains("localhost")) {
            urlBuilder.append("&redirect_uri=").append(URLEncoder.encode(redirectUri.trim(), StandardCharsets.UTF_8));
        }
        return urlBuilder.toString();
    }

    /**
     * Trao đổi authorization code lấy Access Token và Refresh Token từ TikTok Shop auth endpoint.
     * Gọi GET tới https://auth.tiktok-shops.com/api/v2/token/get với các tham số:
     * app_key, app_secret, auth_code, grant_type=authorized_code.
     */
    public JsonNode exchangeToken(String appKey, String appSecret, String authCode) {
        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new IllegalArgumentException("App Key và App Secret không được để trống khi trao đổi token");
        }
        if (authCode == null || authCode.isBlank()) {
            throw new IllegalArgumentException("Authorization code không được để trống");
        }

        StringBuilder urlBuilder = new StringBuilder(TikTokShopConstants.TOKEN_GET_URL);
        urlBuilder.append("?app_key=").append(URLEncoder.encode(appKey.trim(), StandardCharsets.UTF_8))
                .append("&app_secret=").append(URLEncoder.encode(appSecret.trim(), StandardCharsets.UTF_8))
                .append("&auth_code=").append(URLEncoder.encode(authCode.trim(), StandardCharsets.UTF_8))
                .append("&grant_type=authorized_code");

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(urlBuilder.toString(), String.class);
            return parseAndValidateResponse(response.getBody());
        } catch (HttpStatusCodeException e) {
            handleHttpException("GET", TikTokShopConstants.TOKEN_GET_URL, e);
            throw e;
        } catch (LoiCoMaException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi khi trao đổi authorization code TikTok Shop: {}", e.getMessage());
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_AUTH_FAILED,
                    "Không thể trao đổi mã ủy quyền với máy chủ TikTok Shop: " + e.getMessage());
        }
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
     * Thực thi lệnh GET có ký số và header x-tts-access-token, bắt ngoại lệ HTTP và kiểm tra mã phản hồi nghiệp vụ.
     */
    public JsonNode executeGet(String fullSignedUrl, String accessToken) {
        HttpEntity<Void> entity = new HttpEntity<>(createHeaders(accessToken));
        try {
            ResponseEntity<String> response = restTemplate.exchange(fullSignedUrl, HttpMethod.GET, entity, String.class);
            return parseAndValidateResponse(response.getBody());
        } catch (HttpStatusCodeException e) {
            handleHttpException("GET", fullSignedUrl, e);
            throw e;
        } catch (LoiCoMaException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi kết nối tới TikTok Shop API GET [{}]: {}", fullSignedUrl, e.getMessage());
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_API_ERROR,
                    "Không thể kết nối tới TikTok Shop Open API: " + e.getMessage());
        }
    }

    /**
     * Thực thi lệnh POST có ký số, body JSON và header x-tts-access-token, bắt ngoại lệ HTTP và kiểm tra mã phản hồi.
     */
    public JsonNode executePost(String fullSignedUrl, String body, String accessToken) {
        HttpEntity<String> entity = new HttpEntity<>(body, createHeaders(accessToken));
        try {
            ResponseEntity<String> response = restTemplate.exchange(fullSignedUrl, HttpMethod.POST, entity, String.class);
            return parseAndValidateResponse(response.getBody());
        } catch (HttpStatusCodeException e) {
            handleHttpException("POST", fullSignedUrl, e);
            throw e;
        } catch (LoiCoMaException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi kết nối tới TikTok Shop API POST [{}]: {}", fullSignedUrl, e.getMessage());
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_API_ERROR,
                    "Không thể gửi dữ liệu tới TikTok Shop Open API: " + e.getMessage());
        }
    }

    /**
     * Parse JSON phản hồi từ TikTok Shop và kiểm tra mã nghiệp vụ `code`.
     * Theo đặc tả v202309: `code == 0` là thành công, khác 0 là lỗi.
     */
    public JsonNode parseAndValidateResponse(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_API_ERROR,
                    "TikTok Shop API trả về phản hồi rỗng.");
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            if (root.has("code") && root.get("code").asInt() != 0) {
                int code = root.get("code").asInt();
                String message = root.path("message").asText("Lỗi từ máy chủ TikTok Shop");
                log.warn("TikTok Shop API trả về mã lỗi nghiệp vụ: code={}, message={}", code, message);
                throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TIKTOK_API_ERROR,
                        "Lỗi từ TikTok Shop (" + code + "): " + message);
            }
            return root;
        } catch (LoiCoMaException e) {
            throw e;
        } catch (Exception e) {
            log.error("Không thể phân giải JSON từ TikTok Shop: {}, nội dung: {}", e.getMessage(), responseBody);
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_API_ERROR,
                    "Định dạng phản hồi từ TikTok Shop không hợp lệ: " + e.getMessage());
        }
    }

    /**
     * Xử lý ngoại lệ HTTP status code, đặc biệt nhận diện HTTP 429 Rate Limit để tránh cháy request.
     */
    private void handleHttpException(String method, String url, HttpStatusCodeException e) {
        log.error("TikTok Shop API {} HTTP Error: url={}, status={}, body={}", method, url, e.getStatusCode(), e.getResponseBodyAsString());
        if (e.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
            throw new LoiCoMaException(HttpStatus.TOO_MANY_REQUESTS, MaLoi.TIKTOK_RATE_LIMIT,
                    "Vượt giới hạn tần suất gọi API của TikTok Shop (HTTP 429). Hệ thống đang tạm hoãn để bảo vệ hạn mức.");
        }
        try {
            JsonNode errorNode = objectMapper.readTree(e.getResponseBodyAsString());
            String message = errorNode.path("message").asText(e.getStatusText());
            int code = errorNode.path("code").asInt(e.getStatusCode().value());
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TIKTOK_API_ERROR,
                    "Lỗi từ TikTok Shop (" + code + "): " + message);
        } catch (LoiCoMaException ex) {
            throw ex;
        } catch (Exception parseEx) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TIKTOK_API_ERROR,
                    "Lỗi gọi TikTok Shop API: HTTP " + e.getStatusCode().value() + " - " + e.getStatusText());
        }
    }
}
