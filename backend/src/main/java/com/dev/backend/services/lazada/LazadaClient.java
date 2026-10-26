package com.dev.backend.services.lazada;

import com.dev.backend.dto.response.customize.LazadaTestConnectionResponse;
import com.dev.backend.utils.LazadaSignatureHelper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * Client kết nối và thực thi các lệnh gọi REST API tới Lazada Open Platform (LazOP).
 * Tự động tính toán chữ ký số HMAC-SHA256 và xử lý các phản hồi JSON từ cổng Lazada.
 */
@Component
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class LazadaClient {

    public static final String AUTH_GATEWAY = "https://auth.lazada.com/rest";
    public static final String API_GATEWAY_VN = "https://api.lazada.vn/rest";
    public static final String OAUTH_AUTHORIZE_URL = "https://auth.lazada.com/oauth/authorize";
    public static final String DEFAULT_CALLBACK_URL = "https://fcentric.net";

    RestTemplate restTemplate;
    ObjectMapper objectMapper;

    public LazadaClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Tạo đường dẫn ủy quyền Seller Authorization để chuyển hướng người dùng sang Lazada Seller Center.
     * Luôn đảm bảo có tham số redirect_uri (mặc định lấy Callback URL đã cấu hình trên Lazada Developer Console)
     * để tránh lỗi "Thiếu Tham số" khi người bán bấm [Use Seller Login].
     */
    public String generateAuthUrl(String appKey, String redirectUri) {
        return generateAuthUrl(appKey, redirectUri, java.util.UUID.randomUUID().toString());
    }

    public String generateAuthUrl(String appKey, String redirectUri, String state) {
        if (appKey == null || appKey.isBlank()) {
            throw new IllegalArgumentException("App Key không được để trống");
        }
        String targetUri = (redirectUri != null && !redirectUri.isBlank() && !redirectUri.contains("localhost"))
                ? redirectUri.trim()
                : DEFAULT_CALLBACK_URL;
        String encodedUri = URLEncoder.encode(targetUri, StandardCharsets.UTF_8);
        String stateParam = (state != null && !state.isBlank())
                ? "&state=" + URLEncoder.encode(state.trim(), StandardCharsets.UTF_8)
                : "";
        return String.format("%s?response_type=code&force_auth=true&redirect_uri=%s&client_id=%s%s",
                OAUTH_AUTHORIZE_URL, encodedUri, appKey.trim(), stateParam);
    }

    /**
     * Gọi API /auth/token/create để đổi mã code lấy Access Token và Refresh Token.
     */
    public JsonNode exchangeToken(String appKey, String appSecret, String code) {
        String apiPath = "/auth/token/create";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("code", code.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        return executePostForm(AUTH_GATEWAY + apiPath, params);
    }

    /**
     * Gọi API /auth/token/refresh để làm mới Access Token bằng Refresh Token.
     */
    public JsonNode refreshToken(String appKey, String appSecret, String refreshToken) {
        String apiPath = "/auth/token/refresh";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("refresh_token", refreshToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        return executePostForm(AUTH_GATEWAY + apiPath, params);
    }

    /**
     * Kiểm tra kết nối tới Lazada Open Platform qua API /seller/get.
     */
    public LazadaTestConnectionResponse testConnection(String appKey, String appSecret, String accessToken) {
        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank()) {
            return LazadaTestConnectionResponse.builder()
                    .connected(false)
                    .message("Vui lòng cấu hình App Key và App Secret của Lazada")
                    .build();
        }
        if (accessToken == null || accessToken.isBlank()) {
            return LazadaTestConnectionResponse.builder()
                    .connected(false)
                    .message("Chưa có Access Token, vui lòng thực hiện ủy quyền gian hàng Lazada")
                    .build();
        }

        String apiPath = "/seller/get";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        try {
            JsonNode res = executeGet(API_GATEWAY_VN + apiPath, params);
            String code = res.path("code").asText("");
            if ("0".equals(code)) {
                JsonNode data = res.path("data");
                return LazadaTestConnectionResponse.builder()
                        .connected(true)
                        .sellerId(data.path("seller_id").asText(""))
                        .shopName(data.path("name").asText("Gian hàng Lazada"))
                        .shortCode(data.path("short_code").asText(""))
                        .country(data.path("location").asText("VN"))
                        .message("Kết nối thành công tới gian hàng Lazada")
                        .build();
            } else {
                String errorMsg = res.path("message").asText(res.path("sub_message").asText("Lỗi kết nối từ Lazada"));
                return LazadaTestConnectionResponse.builder()
                        .connected(false)
                        .message("Lazada báo lỗi: " + errorMsg)
                        .build();
            }
        } catch (Exception e) {
            log.warn("Lỗi kiểm tra kết nối Lazada: {}", e.getMessage());
            return LazadaTestConnectionResponse.builder()
                    .connected(false)
                    .message("Không thể kết nối tới máy chủ Lazada: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Lấy danh sách đơn hàng từ Lazada (/orders/get).
     */
    public JsonNode getOrders(String appKey, String appSecret, String accessToken, Instant createdAfter, Integer limit, Integer offset) {
        String apiPath = "/orders/get";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);
        params.put("sort_by", "created_at");
        params.put("sort_direction", "DESC");
        params.put("limit", String.valueOf(limit != null ? limit : 50));
        params.put("offset", String.valueOf(offset != null ? offset : 0));

        if (createdAfter != null) {
            DateTimeFormatter formatter = DateTimeFormatter.ISO_OFFSET_DATE_TIME.withZone(ZoneId.of("Asia/Ho_Chi_Minh"));
            params.put("created_after", formatter.format(createdAfter));
        }

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        return executeGet(API_GATEWAY_VN + apiPath, params);
    }

    /**
     * Lấy danh sách sản phẩm trong một đơn hàng (/order/items/get).
     */
    public JsonNode getOrderItems(String appKey, String appSecret, String accessToken, String orderId) {
        String apiPath = "/order/items/get";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("order_id", orderId.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        return executeGet(API_GATEWAY_VN + apiPath, params);
    }

    /**
     * Lấy danh sách sản phẩm từ Lazada Open Platform (/products/get).
     * @param filter "all" hoặc "live"
     * @param limit Số sản phẩm mỗi trang (tối đa 50)
     * @param offset Vị trí bắt đầu
     */
    public JsonNode getProducts(String appKey, String appSecret, String accessToken, String filter, Integer limit, Integer offset) {
        String apiPath = "/products/get";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);
        params.put("filter", (filter != null && !filter.isBlank()) ? filter.trim() : "all");
        params.put("limit", String.valueOf(limit != null ? limit : 50));
        params.put("offset", String.valueOf(offset != null ? offset : 0));

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        return executeGet(API_GATEWAY_VN + apiPath, params);
    }

    /**
     * Cập nhật số lượng tồn kho lên Lazada (/product/price_quantity/update).
     * @param payload Chuỗi XML theo chuẩn Lazada:
     *                &lt;Request&gt;&lt;Product&gt;&lt;Skus&gt;&lt;Sku&gt;&lt;SellerSku&gt;...&lt;/SellerSku&gt;&lt;Quantity&gt;...&lt;/Quantity&gt;&lt;/Sku&gt;&lt;/Skus&gt;&lt;/Product&gt;&lt;/Request&gt;
     */
    public JsonNode updatePriceQuantity(String appKey, String appSecret, String accessToken, String payload) {
        String apiPath = "/product/price_quantity/update";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("payload", payload);
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        return executePostForm(API_GATEWAY_VN + apiPath, params);
    }

    /**
     * Tạo mới sản phẩm trên Lazada Open Platform (/product/create).
     * @param payload Chuỗi XML theo chuẩn LazOP:
     *                &lt;Request&gt;&lt;Product&gt;&lt;PrimaryCategory&gt;...&lt;/PrimaryCategory&gt;&lt;Attributes&gt;...&lt;/Attributes&gt;&lt;Skus&gt;...&lt;/Skus&gt;&lt;/Product&gt;&lt;/Request&gt;
     */
    public JsonNode createProduct(String appKey, String appSecret, String accessToken, String payload) {
        String apiPath = "/product/create";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("payload", payload);
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        return executePostForm(API_GATEWAY_VN + apiPath, params);
    }

    /**
     * Lấy toàn bộ cây danh mục sản phẩm từ Lazada (/category/tree/get).
     */
    public JsonNode getCategoryTree(String appKey, String appSecret, String accessToken, String languageCode) {
        String apiPath = "/category/tree/get";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);
        if (languageCode != null && !languageCode.isBlank()) {
            params.put("language_code", languageCode.trim());
        }

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        return executeGet(API_GATEWAY_VN + apiPath, params);
    }

    /**
     * Upload ảnh nhị phân lên CDN Lazada (/image/upload) để nhận URL .slatic.net.
     */
    public JsonNode uploadImage(String appKey, String appSecret, String accessToken, byte[] imageBytes, String fileName) {
        String apiPath = "/image/upload";
        Map<String, String> queryParams = new HashMap<>();
        queryParams.put("app_key", appKey.trim());
        queryParams.put("access_token", accessToken.trim());
        queryParams.put("timestamp", String.valueOf(System.currentTimeMillis()));
        queryParams.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        // Tham số binary byte[] loại trừ khỏi chuỗi tính chữ ký số theo tài liệu LazOP
        String sign = LazadaSignatureHelper.calculateSignature(apiPath, queryParams, appSecret);
        queryParams.put("sign", sign);

        StringBuilder urlBuilder = new StringBuilder(API_GATEWAY_VN).append(apiPath).append("?");
        boolean first = true;
        for (Map.Entry<String, String> entry : queryParams.entrySet()) {
            if (!first) {
                urlBuilder.append("&");
            }
            urlBuilder.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
                    .append("=")
                    .append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
            first = false;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        ByteArrayResource resource = new ByteArrayResource(imageBytes) {
            @Override
            public String getFilename() {
                return (fileName != null && !fileName.isBlank()) ? fileName : "product_image.jpg";
            }
        };
        form.add("image", resource);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(form, headers);
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(urlBuilder.toString(), requestEntity, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (HttpStatusCodeException e) {
            log.error("Lazada uploadImage HTTP Error: status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            try {
                return objectMapper.readTree(e.getResponseBodyAsString());
            } catch (Exception parseEx) {
                throw new IllegalStateException("Lỗi gọi Lazada uploadImage: " + e.getStatusCode(), e);
            }
        } catch (Exception e) {
            log.error("Lỗi khi upload ảnh sang Lazada: {}", e.getMessage());
            throw new IllegalStateException("Không thể upload ảnh sang Lazada: " + e.getMessage(), e);
        }
    }

    private JsonNode executeGet(String url, Map<String, String> params) {
        StringBuilder urlBuilder = new StringBuilder(url);
        if (params != null && !params.isEmpty()) {
            urlBuilder.append("?");
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
        }

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(urlBuilder.toString(), String.class);
            return objectMapper.readTree(response.getBody());
        } catch (HttpStatusCodeException e) {
            log.error("Lazada API HTTP Error: status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            try {
                return objectMapper.readTree(e.getResponseBodyAsString());
            } catch (Exception parseEx) {
                throw new IllegalStateException("Lỗi gọi Lazada API: " + e.getStatusCode(), e);
            }
        } catch (Exception e) {
            log.error("Lỗi khi gửi yêu cầu tới Lazada API: {}", e.getMessage());
            throw new IllegalStateException("Không thể kết nối tới Lazada: " + e.getMessage(), e);
        }
    }

    private JsonNode executePostForm(String url, Map<String, String> params) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        if (params != null) {
            for (Map.Entry<String, String> entry : params.entrySet()) {
                form.add(entry.getKey(), entry.getValue());
            }
        }

        HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(form, headers);
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, requestEntity, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (HttpStatusCodeException e) {
            log.error("Lazada API POST HTTP Error: status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            try {
                return objectMapper.readTree(e.getResponseBodyAsString());
            } catch (Exception parseEx) {
                throw new IllegalStateException("Lỗi gọi Lazada API POST: " + e.getStatusCode(), e);
            }
        } catch (Exception e) {
            log.error("Lỗi khi gửi yêu cầu POST tới Lazada: {}", e.getMessage());
            throw new IllegalStateException("Không thể gửi dữ liệu tới Lazada: " + e.getMessage(), e);
        }
    }
}

