package com.dev.backend.services.tiktok;

import com.dev.backend.constants.TikTokShopConstants;
import com.dev.backend.dto.response.customize.TikTokAuthorizedShopsResponse;
import com.dev.backend.dto.response.customize.TikTokShopDto;
import com.dev.backend.dto.response.customize.TikTokWarehouseDto;
import com.dev.backend.dto.response.customize.TikTokWarehousesResponse;
import com.dev.backend.dto.response.customize.TikTokProductDto;
import com.dev.backend.dto.response.customize.TikTokProductSearchResponse;
import com.dev.backend.dto.response.customize.TikTokSkuDto;
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
     * Làm mới Access Token bằng Refresh Token qua TikTok Shop Auth API.
     * Endpoint: GET https://auth.tiktok-shops.com/api/v2/token/refresh
     * Tham số: app_key, app_secret, refresh_token, grant_type=refresh_token
     */
    public JsonNode refreshToken(String appKey, String appSecret, String refreshToken) {
        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new IllegalArgumentException("App Key và App Secret không được để trống khi làm mới token");
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalArgumentException("Refresh Token không được để trống");
        }

        StringBuilder urlBuilder = new StringBuilder(TikTokShopConstants.TOKEN_REFRESH_URL);
        urlBuilder.append("?app_key=").append(URLEncoder.encode(appKey.trim(), StandardCharsets.UTF_8))
                .append("&app_secret=").append(URLEncoder.encode(appSecret.trim(), StandardCharsets.UTF_8))
                .append("&refresh_token=").append(URLEncoder.encode(refreshToken.trim(), StandardCharsets.UTF_8))
                .append("&grant_type=refresh_token");

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(urlBuilder.toString(), String.class);
            return parseAndValidateResponse(response.getBody());
        } catch (HttpStatusCodeException e) {
            handleHttpException("GET", TikTokShopConstants.TOKEN_REFRESH_URL, e);
            throw e;
        } catch (LoiCoMaException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi khi làm mới token TikTok Shop: {}", e.getMessage());
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_TOKEN_EXPIRED,
                    "Không thể làm mới Access Token từ máy chủ TikTok Shop: " + e.getMessage());
        }
    }

    /**
     * Lấy danh sách gian hàng được người bán ủy quyền và trích xuất shop_cipher (v202309).
     * Endpoint: GET /authorization/202309/shops
     * Yêu cầu: Header x-tts-access-token, query params (app_key, timestamp, sign).
     * Không cần shop_cipher trong query vì endpoint này dùng để tra cứu cipher.
     */
    /**
     * Lấy danh sách kho hàng logistics từ TikTok Shop Open Platform (v202309).
     * Endpoint: GET /logistics/202309/warehouses
     * Query: app_key, timestamp, shop_cipher, sign
     * Header: x-tts-access-token
     */
    public TikTokWarehousesResponse getWarehouses(String appKey, String appSecret, String accessToken, String shopCipher) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalArgumentException("Access Token không được để trống khi lấy danh sách kho TikTok Shop");
        }
        if (shopCipher == null || shopCipher.isBlank()) {
            throw new IllegalArgumentException("Shop Cipher không được để trống khi lấy danh sách kho TikTok Shop");
        }
        String apiPath = TikTokShopConstants.PATH_WAREHOUSES;
        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, Map.of(), null, appKey, appSecret, shopCipher);
        JsonNode root = executeGet(fullSignedUrl, accessToken);

        TikTokWarehousesResponse response = new TikTokWarehousesResponse();
        response.setCode(root.path("code").asInt(0));
        response.setMessage(root.path("message").asText(""));
        response.setRequestId(root.path("request_id").asText(""));

        JsonNode warehousesNode = root.path("data").path("warehouses");
        if (warehousesNode.isArray()) {
            java.util.List<TikTokWarehouseDto> list = new java.util.ArrayList<>();
            for (JsonNode w : warehousesNode) {
                TikTokWarehouseDto dto = new TikTokWarehouseDto();
                dto.setWarehouseId(w.path("warehouse_id").asText(null));
                dto.setWarehouseName(w.path("warehouse_name").asText(null));
                dto.setWarehouseType(w.path("warehouse_type").asText(null));
                dto.setWarehouseSubType(w.path("warehouse_sub_type").asText(null));
                dto.setWarehouseEffectStatus(w.path("warehouse_effect_status").asText(null));
                dto.setIsDefault(w.path("is_default").asBoolean(false));
                list.add(dto);
            }
            response.setWarehouses(list);
        }
        return response;
    }

    /**
     * Tìm kiếm danh mục sản phẩm và SKU từ TikTok Shop Open Platform (v202309).
     * Endpoint: POST /product/202309/products/search
     * Query: app_key, timestamp, shop_cipher, sign, page_size, page_token (nếu có)
     * Header: x-tts-access-token, Content-Type: application/json
     * Body: JSON payload tiêu chí lọc (vd: {"status": "ACTIVATE"} hoặc rỗng {})
     */
    public TikTokProductSearchResponse searchProducts(String appKey, String appSecret, String accessToken,
                                                      String shopCipher, int pageSize, String pageToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalArgumentException("Access Token không được để trống khi tìm kiếm sản phẩm TikTok Shop");
        }
        if (shopCipher == null || shopCipher.isBlank()) {
            throw new IllegalArgumentException("Shop Cipher không được để trống khi tìm kiếm sản phẩm TikTok Shop");
        }

        Map<String, String> queryParams = new HashMap<>();
        int validPageSize = Math.max(1, Math.min(pageSize, 100)); // TikTok tối đa 100 sản phẩm / trang
        queryParams.put("page_size", String.valueOf(validPageSize));
        if (pageToken != null && !pageToken.isBlank()) {
            queryParams.put("page_token", pageToken.trim());
        }

        String apiPath = TikTokShopConstants.PATH_PRODUCTS_SEARCH;
        String body = "{}"; // JSON rỗng để lấy toàn bộ danh mục

        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, queryParams, body, appKey, appSecret, shopCipher);
        JsonNode root = executePost(fullSignedUrl, body, accessToken);

        TikTokProductSearchResponse response = new TikTokProductSearchResponse();
        response.setCode(root.path("code").asInt(0));
        response.setMessage(root.path("message").asText(""));
        response.setRequestId(root.path("request_id").asText(""));

        JsonNode dataNode = root.path("data");
        if (dataNode.isObject()) {
            TikTokProductSearchResponse.ProductSearchData data = new TikTokProductSearchResponse.ProductSearchData();
            data.setNextPageToken(dataNode.path("next_page_token").asText(null));
            data.setTotalCount(dataNode.path("total_count").asInt(0));

            JsonNode productsNode = dataNode.path("products");
            if (productsNode.isArray()) {
                java.util.List<TikTokProductDto> prodList = new java.util.ArrayList<>();
                for (JsonNode p : productsNode) {
                    TikTokProductDto prodDto = new TikTokProductDto();
                    prodDto.setId(p.path("id").asText(null));
                    prodDto.setTitle(p.path("title").asText(null));
                    prodDto.setStatus(p.path("status").asText(null));

                    JsonNode skusNode = p.path("skus");
                    if (skusNode.isArray()) {
                        java.util.List<TikTokSkuDto> skuList = new java.util.ArrayList<>();
                        for (JsonNode skuItem : skusNode) {
                            TikTokSkuDto skuDto = new TikTokSkuDto();
                            skuDto.setId(skuItem.path("id").asText(null));
                            skuDto.setSellerSku(skuItem.path("seller_sku").asText(null));

                            JsonNode priceNode = skuItem.path("price");
                            if (priceNode.isObject()) {
                                TikTokSkuDto.Price price = new TikTokSkuDto.Price(
                                        priceNode.path("currency").asText(null),
                                        priceNode.path("tax_exclusive_price").asText(null)
                                );
                                skuDto.setPrice(price);
                            }
                            skuList.add(skuDto);
                        }
                        prodDto.setSkus(skuList);
                    }
                    prodList.add(prodDto);
                }
                data.setProducts(prodList);
            }
            response.setData(data);
        }
        return response;
    }

    public TikTokAuthorizedShopsResponse getAuthorizedShops(String appKey, String appSecret, String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalArgumentException("Access Token không được để trống khi lấy danh sách gian hàng TikTok Shop");
        }
        String apiPath = TikTokShopConstants.PATH_AUTHORIZED_SHOPS;
        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, Map.of(), null, appKey, appSecret, null);
        JsonNode root = executeGet(fullSignedUrl, accessToken);

        TikTokAuthorizedShopsResponse response = new TikTokAuthorizedShopsResponse();
        response.setCode(root.path("code").asInt(0));
        response.setMessage(root.path("message").asText(""));
        response.setRequestId(root.path("request_id").asText(""));

        JsonNode shopsNode = root.path("data").path("shops");
        if (shopsNode.isArray()) {
            java.util.List<TikTokShopDto> list = new java.util.ArrayList<>();
            for (JsonNode s : shopsNode) {
                TikTokShopDto dto = new TikTokShopDto();
                dto.setCipher(s.path("cipher").asText(null));
                dto.setCode(s.path("code").asText(null));
                dto.setId(s.path("id").asText(null));
                dto.setName(s.path("name").asText(null));
                dto.setRegion(s.path("region").asText(null));
                dto.setSellerType(s.path("seller_type").asText(null));
                list.add(dto);
            }
            response.setShops(list);
        }
        return response;
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
