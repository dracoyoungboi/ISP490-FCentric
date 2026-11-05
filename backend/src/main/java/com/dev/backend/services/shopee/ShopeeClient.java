package com.dev.backend.services.shopee;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Client kết nối và thực thi các lệnh gọi REST API tới Shopee Open Platform API v2.
 * Tự động tính toán chữ ký số HMAC-SHA256 theo chuẩn Shopee và điều hướng môi trường Sandbox / Production.
 */
@Component
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ShopeeClient {

    public static final String PRODUCTION_HOST = "https://partner.shopeemobile.com";
    public static final String SANDBOX_HOST = "https://partner.test-stable.shopeemobile.com";
    public static final String DEFAULT_CALLBACK_URL = "https://fcentric.net/channels/shopee/callback";

    public static final String PATH_AUTH = "/api/v2/shop/auth_partner";
    public static final String PATH_TOKEN_GET = "/api/v2/auth/token/get";
    public static final String PATH_TOKEN_REFRESH = "/api/v2/auth/access_token/get";
    public static final String PATH_ORDER_LIST = "/api/v2/order/get_order_list";
    public static final String PATH_ORDER_DETAIL = "/api/v2/order/get_order_detail";
    public static final String PATH_UPDATE_STOCK = "/api/v2/product/update_stock";
    public static final String PATH_SHIP_ORDER = "/api/v2/logistics/ship_order";
    public static final String PATH_CREATE_DOC = "/api/v2/logistics/create_shipping_document";
    public static final String PATH_DOWNLOAD_DOC = "/api/v2/logistics/download_shipping_document";

    RestTemplate restTemplate;
    ObjectMapper objectMapper;

    public ShopeeClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Kiểm tra kênh có phải là Shopee Sandbox nội bộ hoặc môi trường thử nghiệm hay không.
     */
    public static boolean isSandbox(String channelCode) {
        return channelCode != null && ("SHOPEE_SANDBOX".equalsIgnoreCase(channelCode.trim())
                || channelCode.toUpperCase().contains("MOCK"));
    }

    /**
     * Sinh URL ủy quyền OAuth cho Seller đăng nhập Shopee Seller Center.
     */
    public String generateAuthUrl(String partnerId, String partnerKey, String redirectUri, boolean isSandbox) {
        if (partnerId == null || partnerId.isBlank() || partnerKey == null || partnerKey.isBlank()) {
            throw new IllegalArgumentException("Partner ID và Partner Key không được để trống");
        }
        String host = isSandbox ? SANDBOX_HOST : PRODUCTION_HOST;
        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildPublicBaseString(partnerId, PATH_AUTH, timestamp);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String targetRedirect = (redirectUri != null && !redirectUri.isBlank()) ? redirectUri.trim() : DEFAULT_CALLBACK_URL;
        String encodedRedirect = URLEncoder.encode(targetRedirect, StandardCharsets.UTF_8);

        return String.format("%s%s?partner_id=%s&timestamp=%d&sign=%s&redirect=%s",
                host, PATH_AUTH, partnerId.trim(), timestamp, sign, encodedRedirect);
    }

    /**
     * Đổi mã code lấy Access Token và Refresh Token từ Shopee.
     */
    public JsonNode getToken(String partnerId, String partnerKey, String code, String shopId, boolean isSandbox) {
        String host = isSandbox ? SANDBOX_HOST : PRODUCTION_HOST;
        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildPublicBaseString(partnerId, PATH_TOKEN_GET, timestamp);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&sign=%s",
                host, PATH_TOKEN_GET, partnerId.trim(), timestamp, sign);

        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("partner_id", Long.parseLong(partnerId.trim()));
        if (shopId != null && !shopId.isBlank()) {
            try {
                body.put("shop_id", Long.parseLong(shopId.trim()));
            } catch (NumberFormatException ignored) {
            }
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (Exception ex) {
            log.error("[SHOPEE-CLIENT] Lỗi khi đổi token Shopee: {}", ex.getMessage());
            throw new RuntimeException("Lỗi kết nối Shopee API: " + ex.getMessage(), ex);
        }
    }

    /**
     * Cập nhật tồn kho sản phẩm/biến thể lên sàn Shopee (/api/v2/product/update_stock).
     */
    public JsonNode updateStock(String partnerId, String partnerKey, String accessToken, String shopId,
                                Long itemId, Long modelId, int stock, boolean isSandbox) {
        if (isSandbox) {
            log.info("[SHOPEE-MOCK-UPDATE-STOCK] Giả lập cập nhật tồn kho thành công cho Shopee: item={}, model={}, stock={}",
                    itemId, modelId, stock);
            return objectMapper.createObjectNode()
                    .put("error", "")
                    .put("message", "success");
        }

        String host = PRODUCTION_HOST;
        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_UPDATE_STOCK, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                host, PATH_UPDATE_STOCK, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        Map<String, Object> body = new HashMap<>();
        body.put("item_id", itemId);
        if (modelId != null && modelId > 0) {
            body.put("stock_list", java.util.List.of(
                    Map.of("model_id", modelId, "normal_stock", stock)
            ));
        } else {
            body.put("stock_list", java.util.List.of(
                    Map.of("normal_stock", stock)
            ));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (Exception ex) {
            log.warn("[SHOPEE-CLIENT] Không thể cập nhật tồn kho Shopee cho itemId {}: {}", itemId, ex.getMessage());
            return objectMapper.createObjectNode()
                    .put("error", "API_ERROR")
                    .put("message", ex.getMessage());
        }
    }
}
