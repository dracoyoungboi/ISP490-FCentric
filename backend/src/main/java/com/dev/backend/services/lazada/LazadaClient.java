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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
        // Khi dùng tài khoản test sandbox (đăng nhập qua link SSO không có mật khẩu): tạm comment &force_auth=true
        // Khi quay lại production với tài khoản thật, chỉ cần gỡ comment dòng dưới:
        return String.format("%s?response_type=code&force_auth=true&redirect_uri=%s&client_id=%s%s",
                OAUTH_AUTHORIZE_URL, encodedUri, appKey.trim(), stateParam);
        // return String.format("%s?response_type=code&redirect_uri=%s&client_id=%s%s",
        //         OAUTH_AUTHORIZE_URL, encodedUri, appKey.trim(), stateParam);
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
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX")
                    .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));
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
     * Đóng gói đơn hàng trên sàn Lazada (/order/fulfill/pack).
     * Chuyển trạng thái đơn/sản phẩm từ pending sang packed và sinh package_id.
     */
    public JsonNode packOrder(String appKey, String appSecret, String accessToken, String orderId, List<String> orderItemIdList) {
        String apiPath = "/order/fulfill/pack";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        StringBuilder packOrderListJson = new StringBuilder();
        packOrderListJson.append("[{\"order_id\":").append(orderId.trim());
        if (orderItemIdList != null && !orderItemIdList.isEmpty()) {
            packOrderListJson.append(",\"order_item_list\":[")
                    .append(String.join(",", orderItemIdList))
                    .append("]");
        }
        packOrderListJson.append("}]");

        String packReqJson = "{\"pack_order_list\":" + packOrderListJson.toString()
                + ",\"delivery_type\":\"dropship\",\"shipping_allocate_type\":\"TFS\"}";
        params.put("packReq", packReqJson);

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        try {
            JsonNode res = executePostForm(API_GATEWAY_VN + apiPath, params);
            String code = res.path("code").asText("");
            if ("0".equals(code) || "".equals(code)) {
                return res;
            }
            log.warn("Gọi /order/fulfill/pack trả về code={}, message={}, fallback sang /order/pack",
                    code, res.path("message").asText(""));
        } catch (Exception ex) {
            log.warn("Ngoại lệ khi gọi /order/fulfill/pack: {}, fallback sang /order/pack", ex.getMessage());
        }

        // Fallback sang API legacy /order/pack
        String legacyPath = "/order/pack";
        Map<String, String> legacyParams = new HashMap<>();
        legacyParams.put("app_key", appKey.trim());
        legacyParams.put("access_token", accessToken.trim());
        legacyParams.put("delivery_type", "dropship");
        legacyParams.put("shipping_allocate_type", "TFS");
        if (orderItemIdList != null && !orderItemIdList.isEmpty()) {
            legacyParams.put("order_item_ids", "[" + String.join(",", orderItemIdList) + "]");
        }
        legacyParams.put("timestamp", String.valueOf(System.currentTimeMillis()));
        legacyParams.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);
        String legacySign = LazadaSignatureHelper.calculateSignature(legacyPath, legacyParams, appSecret);
        legacyParams.put("sign", legacySign);
        return executePostForm(API_GATEWAY_VN + legacyPath, legacyParams);
    }

    /**
     * Xác nhận sẵn sàng giao hàng trên sàn Lazada (/order/package/rts).
     * Chuẩn hóa tham số readyToShipReq, tự động fallback sang /order/rts nếu cần.
     * Chuyển trạng thái kiện hàng từ packed sang ready_to_ship.
     */
    public JsonNode readyToShip(String appKey, String appSecret, String accessToken, String packageId, List<String> orderItemIdList) {
        String apiPath = "/order/package/rts";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

        if (packageId != null && !packageId.isBlank()) {
            params.put("readyToShipReq", "{\"packages\":[{\"package_id\":\"" + packageId.trim() + "\"}]}");
            params.put("packages", "[{\"package_id\":\"" + packageId.trim() + "\"}]");
        } else if (orderItemIdList != null && !orderItemIdList.isEmpty()) {
            params.put("readyToShipReq", "{\"order_item_ids\":[" + String.join(",", orderItemIdList) + "]}");
            params.put("order_item_ids", "[" + String.join(",", orderItemIdList) + "]");
        }

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        try {
            JsonNode res = executePostForm(API_GATEWAY_VN + apiPath, params);
            String code = res.path("code").asText("");
            if ("0".equals(code) || "".equals(code)) {
                return res;
            }
            log.warn("Gọi /order/package/rts trả về code={}, message={}, fallback sang /order/rts",
                    code, res.path("message").asText(""));
        } catch (Exception ex) {
            log.warn("Ngoại lệ khi gọi /order/package/rts: {}, fallback sang /order/rts", ex.getMessage());
        }

        // Fallback sang API legacy /order/rts
        String legacyPath = "/order/rts";
        Map<String, String> legacyParams = new HashMap<>();
        legacyParams.put("app_key", appKey.trim());
        legacyParams.put("access_token", accessToken.trim());
        legacyParams.put("delivery_type", "dropship");
        if (orderItemIdList != null && !orderItemIdList.isEmpty()) {
            legacyParams.put("order_item_ids", "[" + String.join(",", orderItemIdList) + "]");
        }
        legacyParams.put("timestamp", String.valueOf(System.currentTimeMillis()));
        legacyParams.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);
        String legacySign = LazadaSignatureHelper.calculateSignature(legacyPath, legacyParams, appSecret);
        legacyParams.put("sign", legacySign);
        return executePostForm(API_GATEWAY_VN + legacyPath, legacyParams);
    }

    /**
     * Hủy đơn hàng trên sàn Lazada qua cổng chính thức /order/reverse/cancel/create.
     */
    public JsonNode cancelOrder(String appKey, String appSecret, String accessToken, String orderId, List<String> orderItemIdList, String reasonId, String reasonDetail) {
        String apiPath = "/order/reverse/cancel/create";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);
        params.put("order_id", orderId.trim());
        if (orderItemIdList != null && !orderItemIdList.isEmpty()) {
            params.put("order_item_id_list", "[\"" + String.join("\",\"", orderItemIdList) + "\"]");
        }
        params.put("reason_id", reasonId != null && !reasonId.isBlank() ? reasonId : "15");

        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);

        try {
            JsonNode res = executePostForm(API_GATEWAY_VN + apiPath, params);
            String code = res.path("code").asText("");
            if ("0".equals(code) || "".equals(code)) {
                return res;
            }
            // Thử kiểm tra lý do hủy hợp lệ nếu Lazada yêu cầu validate
            String msg = res.path("message").asText(res.path("sub_message").asText(""));
            if (msg.toLowerCase().contains("reason") || msg.toLowerCase().contains("validate")) {
                JsonNode validRes = validateReverseCancel(appKey, appSecret, accessToken, orderId, orderItemIdList);
                JsonNode reasons = validRes.path("data").path("reasons");
                if (reasons.isArray() && !reasons.isEmpty()) {
                    String firstReasonId = reasons.get(0).path("reason_id").asText("");
                    if (!firstReasonId.isBlank()) {
                        params.put("reason_id", firstReasonId);
                        params.remove("sign");
                        params.put("sign", LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret));
                        return executePostForm(API_GATEWAY_VN + apiPath, params);
                    }
                }
            }
            return res;
        } catch (Exception ex) {
            String legacyPath = "/order/cancel";
            params.remove("sign");
            if (orderItemIdList != null && !orderItemIdList.isEmpty()) {
                params.put("order_item_id_list", "[" + String.join(",", orderItemIdList) + "]");
            }
            if (reasonDetail != null && !reasonDetail.isBlank()) {
                params.put("reason_detail", reasonDetail);
            }
            String legacySign = LazadaSignatureHelper.calculateSignature(legacyPath, params, appSecret);
            params.put("sign", legacySign);
            try {
                return executePostForm(API_GATEWAY_VN + legacyPath, params);
            } catch (Exception fallbackEx) {
                log.error("Lỗi khi hủy đơn Lazada: {}", ex.getMessage());
                throw new IllegalStateException("Không thể gửi yêu cầu hủy đơn sang Lazada: " + ex.getMessage(), ex);
            }
        }
    }

    public JsonNode validateReverseCancel(String appKey, String appSecret, String accessToken, String orderId, List<String> orderItemIdList) {
        String apiPath = "/order/reverse/cancel/validate";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);
        params.put("order_id", orderId.trim());
        if (orderItemIdList != null && !orderItemIdList.isEmpty()) {
            params.put("order_item_id_list", "[\"" + String.join("\",\"", orderItemIdList) + "\"]");
        }
        String sign = LazadaSignatureHelper.calculateSignature(apiPath, params, appSecret);
        params.put("sign", sign);
        try {
            return executePostForm(API_GATEWAY_VN + apiPath, params);
        } catch (Exception e) {
            log.warn("Validate cancel order Lazada thất bại: {}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    /**
     * Lấy tài liệu vận đơn (AWB / Shipping Label) từ Lazada Open Platform.
     * Tự động kiểm tra và pack đơn nếu đơn còn ở trạng thái pending/unpacked.
     * Thử endpoint mới /order/package/document/get trước, fallback sang /order/document/get.
     * @param appKey App Key của ứng dụng Lazada
     * @param appSecret App Secret của ứng dụng Lazada
     * @param accessToken Access Token của gian hàng
     * @param orderId Mã đơn hàng trên sàn Lazada
     * @return JsonNode chứa data.document (file base64 và mime_type: text/html hoặc application/pdf)
     */
    public JsonNode getShippingLabel(String appKey, String appSecret, String accessToken, String orderId) {
        JsonNode itemsRes = getOrderItems(appKey, appSecret, accessToken, orderId);
        String code = itemsRes.path("code").asText("0");
        if (!"0".equals(code) && !"".equals(code)) {
            return itemsRes;
        }

        JsonNode items = itemsRes.path("data");
        List<String> itemIds = new ArrayList<>();
        boolean needPack = false;
        if (items.isArray()) {
            for (JsonNode it : items) {
                String itId = it.path("order_item_id").asText("").trim();
                if (!itId.isBlank()) {
                    itemIds.add(itId);
                }
                String status = it.path("status").asText("").trim().toLowerCase();
                if ("pending".equals(status) || "unpacked".equals(status)) {
                    needPack = true;
                }
            }
        }

        if (itemIds.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy sản phẩm nào trong đơn hàng Lazada " + orderId);
        }

        if (needPack) {
            try {
                packOrder(appKey, appSecret, accessToken, orderId, itemIds);
            } catch (Exception e) {
                log.warn("Tự động pack đơn Lazada {} trước khi in vận đơn: {}", orderId, e.getMessage());
            }
        }

        String orderItemIdsJson = "[" + String.join(",", itemIds) + "]";

        // Thử API PrintAWB mới (/order/package/document/get)
        try {
            String modernPath = "/order/package/document/get";
            Map<String, String> modernParams = new HashMap<>();
            modernParams.put("app_key", appKey.trim());
            modernParams.put("access_token", accessToken.trim());
            modernParams.put("doc_type", "shippingLabel");
            modernParams.put("order_item_ids", orderItemIdsJson);
            modernParams.put("timestamp", String.valueOf(System.currentTimeMillis()));
            modernParams.put("sign_method", LazadaSignatureHelper.SIGN_METHOD_SHA256);

            String modernSign = LazadaSignatureHelper.calculateSignature(modernPath, modernParams, appSecret);
            modernParams.put("sign", modernSign);

            JsonNode modernRes = executeGet(API_GATEWAY_VN + modernPath, modernParams);
            String modernCode = modernRes.path("code").asText("0");
            if ("0".equals(modernCode) || "".equals(modernCode)) {
                if (modernRes.path("data").path("document").has("file") || modernRes.path("data").has("document")) {
                    return modernRes;
                }
            }
        } catch (Exception ex) {
            log.warn("Gọi /order/package/document/get gặp lỗi, chuyển sang fallback: {}", ex.getMessage());
        }

        // Fallback sang API /order/document/get
        String apiPath = "/order/document/get";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("doc_type", "shippingLabel");
        params.put("order_item_ids", orderItemIdsJson);
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
     * Cập nhật thông tin và hình ảnh sản phẩm trên Lazada Open Platform (/product/update).
     * @param payload Chuỗi XML theo chuẩn LazOP:
     *                &lt;Request&gt;&lt;Product&gt;&lt;ItemId&gt;...&lt;/ItemId&gt;&lt;Images&gt;...&lt;/Images&gt;&lt;Skus&gt;...&lt;/Skus&gt;&lt;/Product&gt;&lt;/Request&gt;
     */
    public JsonNode updateProduct(String appKey, String appSecret, String accessToken, String payload) {
        String apiPath = "/product/update";
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
     * Lấy danh sách thuộc tính của danh mục sản phẩm (/category/attributes/get).
     */
    public JsonNode getCategoryAttributes(String appKey, String appSecret, String accessToken, long categoryId, String languageCode) {
        String apiPath = "/category/attributes/get";
        Map<String, String> params = new HashMap<>();
        params.put("app_key", appKey.trim());
        params.put("access_token", accessToken.trim());
        params.put("primary_category_id", String.valueOf(categoryId));
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
            java.net.URI uri = java.net.URI.create(urlBuilder.toString());
            ResponseEntity<String> response = restTemplate.getForEntity(uri, String.class);
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

