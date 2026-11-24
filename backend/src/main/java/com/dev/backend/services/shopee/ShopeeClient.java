package com.dev.backend.services.shopee;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.AccessLevel;
import lombok.Getter;
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

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Client toàn diện kết nối Shopee Open Platform API v2.
 * Hỗ trợ 100% các cụm API chuẩn của Shopee:
 * - v2.auth & v2.shop (Xác thực OAuth 2.0, cấp/làm mới Token, thông tin Shop)
 * - v2.order (Lấy đơn, chi tiết đơn, hủy đơn, xử lý yêu cầu hủy của người mua, ghi chú)
 * - v2.product (Danh sách sản phẩm, biến thể, cập nhật tồn kho, cập nhật giá)
 * - v2.logistics (Thông số giao hàng, ship đơn, lấy mã tracking, in vận đơn AWB A6)
 * - v2.payment (Bóc tách chi tiết escrow, phí sàn, doanh thu thực nhận)
 * - Chế độ Sandbox giả lập độc lập tự động khi chưa liên kết tài khoản thật.
 */
@Component
@Slf4j
@Getter
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ShopeeClient {

    public static final String PRODUCTION_HOST = "https://partner.shopeemobile.com";
    public static final String SANDBOX_HOST = "https://openplatform.sandbox.test-stable.shopee.sg";
    public static final String DEFAULT_CALLBACK_URL = "https://fcentric.net/channels/shopee/callback";

    // 1. Auth & Shop Paths
    public static final String PATH_AUTH = "/api/v2/shop/auth_partner";
    public static final String PATH_TOKEN_GET = "/api/v2/auth/token/get";
    public static final String PATH_TOKEN_REFRESH = "/api/v2/auth/access_token/get";
    public static final String PATH_SHOP_INFO = "/api/v2/shop/get_shop_info";
    public static final String PATH_SHOP_PROFILE = "/api/v2/shop/get_profile";
    public static final String PATH_GET_WAREHOUSE_DETAIL = "/api/v2/shop/get_warehouse_detail";
    public static final String PATH_SHOPS_BY_PARTNER = "/api/v2/public/get_shops_by_partner";

    // 2. Order Paths
    public static final String PATH_ORDER_LIST = "/api/v2/order/get_order_list";
    public static final String PATH_ORDER_DETAIL = "/api/v2/order/get_order_detail";
    public static final String PATH_ORDER_CANCEL = "/api/v2/order/cancel_order";
    public static final String PATH_ORDER_HANDLE_CANCEL = "/api/v2/order/handle_buyer_cancellation";
    public static final String PATH_ORDER_SET_NOTE = "/api/v2/order/set_note";

    // 3. Product & Media Paths
    public static final String PATH_MEDIA_UPLOAD_IMAGE = "/api/v2/media_space/upload_image";
    public static final String PATH_LOGISTICS_GET_CHANNEL_LIST = "/api/v2/logistics/get_channel_list";
    public static final String PATH_PRODUCT_GET_CATEGORY = "/api/v2/product/get_category";
    public static final String PATH_PRODUCT_GET_ATTRIBUTES = "/api/v2/product/get_attributes";
    public static final String PATH_PRODUCT_GET_ATTRIBUTE_TREE = "/api/v2/product/get_attribute_tree";
    public static final String PATH_PRODUCT_ADD_ITEM = "/api/v2/product/add_item";
    public static final String PATH_PRODUCT_DELETE_ITEM = "/api/v2/product/delete_item";
    public static final String PATH_PRODUCT_INIT_TIER_VARIATION = "/api/v2/product/init_tier_variation";
    public static final String PATH_PRODUCT_ITEM_LIST = "/api/v2/product/get_item_list";
    public static final String PATH_PRODUCT_BASE_INFO = "/api/v2/product/get_item_base_info";
    public static final String PATH_PRODUCT_MODEL_LIST = "/api/v2/product/get_model_list";
    public static final String PATH_UPDATE_STOCK = "/api/v2/product/update_stock";
    public static final String PATH_UPDATE_PRICE = "/api/v2/product/update_price";
    public static final String PATH_PRODUCT_UPDATE_ITEM = "/api/v2/product/update_item";

    // 4. Logistics Paths
    public static final String PATH_SHIPPING_PARAM = "/api/v2/logistics/get_shipping_parameter";
    public static final String PATH_SHIP_ORDER = "/api/v2/logistics/ship_order";
    public static final String PATH_TRACKING_NUMBER = "/api/v2/logistics/get_tracking_number";
    public static final String PATH_TRACKING_INFO = "/api/v2/logistics/get_tracking_info";
    public static final String PATH_GET_ADDRESS_LIST = "/api/v2/logistics/get_address_list";
    public static final String PATH_CREATE_DOC = "/api/v2/logistics/create_shipping_document";
    public static final String PATH_GET_DOC_RESULT = "/api/v2/logistics/get_shipping_document_result";
    public static final String PATH_GET_DOC_DATA_INFO = "/api/v2/logistics/get_shipping_document_data_info";
    public static final String PATH_DOWNLOAD_DOC = "/api/v2/logistics/download_shipping_document";

    // 5. Payment Paths
    public static final String PATH_ESCROW_DETAIL = "/api/v2/payment/get_escrow_detail";

    RestTemplate restTemplate;
    ObjectMapper objectMapper;

    @lombok.experimental.NonFinal
    Long partnerId;
    @lombok.experimental.NonFinal
    String partnerKey;
    @lombok.experimental.NonFinal
    Long shopId;
    @lombok.experimental.NonFinal
    String accessToken;
    @lombok.experimental.NonFinal
    boolean isSandbox;

    public ShopeeClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.restTemplate = com.dev.backend.services.omnichannel.OmnichannelTelemetryInterceptor.attach(new RestTemplate(factory));
        this.objectMapper = new ObjectMapper();
    }

    public ShopeeClient(long partnerId, String partnerKey, long shopId, String accessToken, boolean isSandbox) {
        this();
        this.partnerId = partnerId;
        this.partnerKey = partnerKey;
        this.shopId = shopId;
        this.accessToken = accessToken;
        this.isSandbox = isSandbox;
    }

    public static boolean isSandbox(String channelCode) {
        return channelCode != null && ("SHOPEE_SANDBOX".equalsIgnoreCase(channelCode.trim())
                || channelCode.toUpperCase().contains("MOCK")
                || channelCode.toUpperCase().contains("SANDBOX"));
    }

    public boolean isSandbox() {
        return this.isSandbox;
    }

    public Long getShopId() {
        return this.shopId;
    }

    public Long getPartnerId() {
        return this.partnerId;
    }

    public String getPartnerKey() {
        return this.partnerKey;
    }

    public String getAccessToken() {
        return this.accessToken;
    }

    public String getHost(boolean isSandbox) {
        return isSandbox ? SANDBOX_HOST : PRODUCTION_HOST;
    }

    public String getHost() {
        return getHost(this.isSandbox);
    }

    // =========================================================================
    // 1. AUTHENTICATION & SHOP APIS
    // =========================================================================

    public String generateAuthUrl(String partnerId, String partnerKey, String redirectUri, boolean isSandbox) {
        if (partnerId == null || partnerId.isBlank() || partnerKey == null || partnerKey.isBlank()) {
            partnerId = "1000888";
            partnerKey = "mock_partner_key";
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

    public JsonNode getToken(String partnerId, String partnerKey, String code, String shopId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK] Giả lập đổi token Shopee OAuth2 cho code={}", code);
            long now = Instant.now().getEpochSecond();
            return objectMapper.createObjectNode()
                    .put("error", "")
                    .put("message", "success")
                    .put("access_token", "shp_at_" + UUID.randomUUID().toString().replace("-", ""))
                    .put("refresh_token", "shp_rt_" + UUID.randomUUID().toString().replace("-", ""))
                    .put("expire_in", 14400) // 4 giờ
                    .put("partner_id", Long.parseLong(partnerId != null && partnerId.matches("\\d+") ? partnerId : "1000888"))
                    .put("shop_id", Long.parseLong(shopId != null && shopId.matches("\\d+") ? shopId : "888666"));
        }

        String host = getHost(isSandbox);
        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildPublicBaseString(partnerId, PATH_TOKEN_GET, timestamp);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&sign=%s", host, PATH_TOKEN_GET, partnerId.trim(), timestamp, sign);

        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("partner_id", Long.parseLong(partnerId.trim()));
        if (shopId != null && !shopId.isBlank() && shopId.matches("\\d+")) {
            body.put("shop_id", Long.parseLong(shopId.trim()));
        }

        return executePost(url, body);
    }

    public JsonNode refreshToken(String partnerId, String partnerKey, String refreshToken, String shopId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK] Giả lập làm mới Access Token Shopee");
            return objectMapper.createObjectNode()
                    .put("error", "")
                    .put("message", "success")
                    .put("access_token", "shp_at_" + UUID.randomUUID().toString().replace("-", ""))
                    .put("refresh_token", "shp_rt_" + UUID.randomUUID().toString().replace("-", ""))
                    .put("expire_in", 14400)
                    .put("partner_id", Long.parseLong(partnerId != null && partnerId.matches("\\d+") ? partnerId : "1000888"))
                    .put("shop_id", Long.parseLong(shopId != null && shopId.matches("\\d+") ? shopId : "888666"));
        }

        String host = getHost(isSandbox);
        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildPublicBaseString(partnerId, PATH_TOKEN_REFRESH, timestamp);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&sign=%s", host, PATH_TOKEN_REFRESH, partnerId.trim(), timestamp, sign);

        Map<String, Object> body = new HashMap<>();
        body.put("refresh_token", refreshToken);
        body.put("partner_id", Long.parseLong(partnerId.trim()));
        if (shopId != null && !shopId.isBlank() && shopId.matches("\\d+")) {
            body.put("shop_id", Long.parseLong(shopId.trim()));
        }

        return executePost(url, body);
    }

    public JsonNode getShopInfo(String partnerId, String partnerKey, String accessToken, String shopId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            resp.put("shop_name", "Gian hàng Shopee FCentric Official")
                    .put("region", "VN")
                    .put("status", "NORMAL")
                    .put("is_sip", false)
                    .put("is_cb", false)
                    .put("auth_time", Instant.now().getEpochSecond() - 86400)
                    .put("expire_time", Instant.now().getEpochSecond() + (365L * 86400));
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_SHOP_INFO, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_SHOP_INFO, partnerId, timestamp, accessToken, shopId, sign);
        return executeGet(url);
    }

    public JsonNode getProfile(String partnerId, String partnerKey, String accessToken, String shopId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            resp.put("shop_logo", "/channel-logos/shopee.svg")
                    .put("description", "Thời trang FCentric - Shopee");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_SHOP_PROFILE, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_SHOP_PROFILE, partnerId, timestamp, accessToken, shopId, sign);
        return executeGet(url);
    }

    public JsonNode getShopsByPartner(String partnerId, String partnerKey, int pageNo, int pageSize, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "");
            ArrayNode list = res.putArray("authed_shop_list");
            ObjectNode shop = list.addObject();
            shop.put("shop_id", 228021980L);
            shop.put("region", "VN");
            shop.put("auth_time", Instant.now().getEpochSecond() - 86400);
            shop.put("expire_time", Instant.now().getEpochSecond() + 31536000);
            return res;
        }

        String host = getHost(isSandbox);
        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildPublicBaseString(partnerId, PATH_SHOPS_BY_PARTNER, timestamp);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&sign=%s&page_no=%d&page_size=%d",
                host, PATH_SHOPS_BY_PARTNER, partnerId.trim(), timestamp, sign, pageNo, pageSize);

        return executeGet(url);
    }

    // =========================================================================
    // 2. ORDER APIS
    // =========================================================================

    public JsonNode getOrderList(String partnerId, String partnerKey, String accessToken, String shopId,
                                 long timeFrom, long timeTo, String orderStatus, int pageSize, String cursor, boolean isSandbox) {
        return getOrderList(partnerId, partnerKey, accessToken, shopId, timeFrom, timeTo, "create_time", orderStatus, pageSize, cursor, isSandbox);
    }

    /**
     * Tra cứu danh sách đơn hàng Shopee OpenAPI v2 (/api/v2/order/get_order_list).
     * <p>RÀNG BUỘC SHOPEE OPENPLATFORM:
     * <ul>
     *   <li>Dữ liệu đơn hàng quá 3 tháng (90 ngày) không thể tìm kiếm hoặc tải về (Data range searchable cannot exceed 90 days).</li>
     *   <li>Khoảng thời gian tra cứu tối đa cho 1 request: time_to - time_from <= 15 ngày.</li>
     * </ul>
     */
    public JsonNode getOrderList(String partnerId, String partnerKey, String accessToken, String shopId,
                                 long timeFrom, long timeTo, String timeRangeField, String orderStatus, int pageSize, String cursor, boolean isSandbox) {
        // Tự động kiểm tra trần 90 ngày (Shopee 3 months retention policy)
        long ninetyDaysAgo = Instant.now().getEpochSecond() - (90L * 86400L);
        if (timeFrom < ninetyDaysAgo) {
            log.warn("[SHOPEE-CLIENT] time_from ({}) vượt quá 90 ngày (Shopee 3 months limit), tự động điều chỉnh về mốc 90 ngày", timeFrom);
            timeFrom = ninetyDaysAgo;
        }

        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            resp.put("more", false);
            resp.put("next_cursor", "");
            ArrayNode arr = resp.putArray("order_list");
            arr.addObject().put("order_sn", "241105" + Math.abs(UUID.randomUUID().hashCode() % 10000000))
                    .put("order_status", orderStatus != null ? orderStatus : "READY_TO_SHIP")
                    .put("update_time", Instant.now().getEpochSecond());
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_ORDER_LIST, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String field = (timeRangeField != null && !timeRangeField.isBlank()) ? timeRangeField.trim() : "create_time";
        StringBuilder url = new StringBuilder(String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&time_range_field=%s&time_from=%d&time_to=%d&page_size=%d",
                getHost(isSandbox), PATH_ORDER_LIST, partnerId, timestamp, accessToken, shopId, sign, field, timeFrom, timeTo, pageSize));
        if (orderStatus != null && !orderStatus.isBlank()) url.append("&order_status=").append(orderStatus);
        if (cursor != null && !cursor.isBlank()) url.append("&cursor=").append(cursor);

        return executeGet(url.toString());
    }

    public JsonNode getOrderDetail(String partnerId, String partnerKey, String accessToken, String shopId,
                                   List<String> orderSnList, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            ArrayNode arr = resp.putArray("order_list");
            for (String sn : (orderSnList != null ? orderSnList : List.of("241105999888"))) {
                ObjectNode ord = arr.addObject();
                ord.put("order_sn", sn);
                ord.put("order_status", "READY_TO_SHIP");
                ord.put("shipping_carrier", "Shopee Xpress (SPX)");
                ord.put("total_amount", 320000);
                ord.put("actual_shipping_fee", 25000);
                ord.put("payment_method", "CASH_ON_DELIVERY");
                ObjectNode addr = ord.putObject("recipient_address");
                addr.put("name", "Nguyễn Văn Test").put("phone", "0901234567").put("full_address", "123 Đường Cầu Giấy, Hà Nội");
            }
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_ORDER_DETAIL, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String snParam = String.join(",", orderSnList);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&order_sn_list=%s&response_optional_fields=buyer_user_id,buyer_username,recipient_address,item_list,package_list,shipping_carrier,payment_method,total_amount,estimated_shipping_fee,actual_shipping_fee,cancel_reason,cancel_user,note,pay_time",
                getHost(isSandbox), PATH_ORDER_DETAIL, partnerId, timestamp, accessToken, shopId, sign, snParam);
        return executeGet(url);
    }

    public JsonNode cancelOrder(String partnerId, String partnerKey, String accessToken, String shopId,
                                String orderSn, String cancelReason, Long itemId, Long modelId, boolean isSandbox) {
        List<Map<String, Object>> itemList = itemId != null
                ? List.of(Map.of("item_id", itemId, "model_id", modelId != null ? modelId : 0L))
                : null;
        return cancelOrder(partnerId, partnerKey, accessToken, shopId, orderSn, cancelReason, itemList, isSandbox);
    }

    public JsonNode cancelOrder(String partnerId, String partnerKey, String accessToken, String shopId,
                                String orderSn, String cancelReason, List<Map<String, Object>> itemList, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK] Giả lập hủy đơn Shopee #{} với lý do {}", orderSn, cancelReason);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_ORDER_CANCEL, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_ORDER_CANCEL, partnerId, timestamp, accessToken, shopId, sign);

        Map<String, Object> body = new HashMap<>();
        body.put("order_sn", orderSn);
        body.put("cancel_reason", cancelReason != null ? cancelReason : "OUT_OF_STOCK");
        if (itemList != null && !itemList.isEmpty()) {
            body.put("item_list", itemList);
        }

        return executePost(url, body);
    }

    public JsonNode handleBuyerCancellation(String partnerId, String partnerKey, String accessToken, String shopId,
                                            String orderSn, String operation, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK] Giả lập phản hồi yêu cầu hủy đơn #{} thao tác={}", orderSn, operation);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_ORDER_HANDLE_CANCEL, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_ORDER_HANDLE_CANCEL, partnerId, timestamp, accessToken, shopId, sign);

        Map<String, Object> body = Map.of(
                "order_sn", orderSn,
                "operation", operation != null ? operation.toUpperCase() : "ACCEPT"
        );
        return executePost(url, body);
    }

    public JsonNode setNote(String partnerId, String partnerKey, String accessToken, String shopId,
                            String orderSn, String note, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK] Lưu ghi chú đơn Shopee #{}: {}", orderSn, note);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_ORDER_SET_NOTE, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_ORDER_SET_NOTE, partnerId, timestamp, accessToken, shopId, sign);

        Map<String, Object> body = Map.of("order_sn", orderSn, "note", note != null ? note : "");
        return executePost(url, body);
    }

    // =========================================================================
    // 3. PRODUCT & INVENTORY APIS
    // =========================================================================

    public JsonNode uploadImage(String partnerId, String partnerKey, String accessToken, String shopId,
                                byte[] imageBytes, String fileName, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK] Giả lập upload ảnh lên Shopee Media Space, size={} bytes", imageBytes != null ? imageBytes.length : 0);
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            String mockImgId = "vn-11134207-mock-" + System.currentTimeMillis();
            res.putObject("response").putObject("image_info").put("image_id", mockImgId);
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_MEDIA_UPLOAD_IMAGE, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_MEDIA_UPLOAD_IMAGE, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        return executeMultipartPost(url, imageBytes, fileName);
    }

    public JsonNode getLogisticsChannelList(String partnerId, String partnerKey, String accessToken, String shopId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            ArrayNode arr = resp.putArray("logistics_channel_list");
            arr.addObject().put("logistics_channel_id", 80001L).put("logistics_channel_name", "Nhanh").put("enabled", true);
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_LOGISTICS_GET_CHANNEL_LIST, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_LOGISTICS_GET_CHANNEL_LIST, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        return executeGet(url);
    }

    public JsonNode getCategoryList(String partnerId, String partnerKey, String accessToken, String shopId, String language, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            ArrayNode arr = resp.putArray("category_list");
            arr.addObject().put("category_id", 100017L).put("parent_category_id", 0L).put("original_category_name", "Thời Trang Nam").put("has_children", false);
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_GET_CATEGORY, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String lang = (language != null && !language.isBlank()) ? language : "vi";
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&language=%s",
                getHost(isSandbox), PATH_PRODUCT_GET_CATEGORY, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign, lang);

        return executeGet(url);
    }

    public JsonNode getAttributes(String partnerId, String partnerKey, String accessToken, String shopId, long categoryId, String language, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response").putArray("attribute_list");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_GET_ATTRIBUTES, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String lang = (language != null && !language.isBlank()) ? language : "vi";
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&category_id=%d&language=%s",
                getHost(isSandbox), PATH_PRODUCT_GET_ATTRIBUTES, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign, categoryId, lang);

        return executeGet(url);
    }

    public JsonNode getAttributeTree(String partnerId, String partnerKey, String accessToken, String shopId, List<Long> categoryIdList, String language, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response").putArray("attribute_tree_list");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_GET_ATTRIBUTE_TREE, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String lang = (language != null && !language.isBlank()) ? language : "vi";
        String catIds = categoryIdList != null ? categoryIdList.stream().map(String::valueOf).collect(Collectors.joining(",")) : "";
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&category_id_list=%s&language=%s",
                getHost(isSandbox), PATH_PRODUCT_GET_ATTRIBUTE_TREE, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign, catIds, lang);

        return executeGet(url);
    }

    public JsonNode deleteItem(String partnerId, String partnerKey, String accessToken, String shopId, long itemId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_DELETE_ITEM, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_PRODUCT_DELETE_ITEM, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        return executePost(url, Map.of("item_id", itemId));
    }

    public JsonNode addItem(String partnerId, String partnerKey, String accessToken, String shopId, Map<String, Object> body, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            long mockItemId = 1000000L + (long)(Math.random() * 900000L);
            log.info("[SHOPEE-MOCK] Giả lập thêm sản phẩm Shopee item_id={}", mockItemId);
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response").put("item_id", mockItemId);
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_ADD_ITEM, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_PRODUCT_ADD_ITEM, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        return executePost(url, body);
    }

    public JsonNode initTierVariation(String partnerId, String partnerKey, String accessToken, String shopId, Map<String, Object> body, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            Long itemId = body.get("item_id") instanceof Number ? ((Number) body.get("item_id")).longValue() : 1000101L;
            log.info("[SHOPEE-MOCK] Giả lập tạo phân loại (tier variation) Shopee cho item_id={}", itemId);
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response").put("item_id", itemId);
            ArrayNode arr = resp.putArray("model");
            ArrayNode arrLegacy = resp.putArray("model_id_list");
            List<?> models = (List<?>) body.get("model");
            long mId = 2000001L;
            if (models != null) {
                for (Object mObj : models) {
                    if (mObj instanceof Map<?,?> mMap) {
                        Object tIdx = mMap.get("tier_index");
                        Object mSku = mMap.get("model_sku");
                        long thisModelId = mId++;

                        ObjectNode node = arr.addObject();
                        node.put("model_id", thisModelId);
                        if (mSku != null) node.put("model_sku", String.valueOf(mSku));

                        ObjectNode legacyNode = arrLegacy.addObject();
                        legacyNode.put("model_id", thisModelId);

                        if (tIdx instanceof List<?> l) {
                            ArrayNode idxArr = node.putArray("tier_index");
                            ArrayNode idxArrLegacy = legacyNode.putArray("tier_index");
                            for (Object o : l) {
                                if (o instanceof Number n) {
                                    idxArr.add(n.intValue());
                                    idxArrLegacy.add(n.intValue());
                                }
                            }
                        }
                    }
                }
            }
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_INIT_TIER_VARIATION, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_PRODUCT_INIT_TIER_VARIATION, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        return executePost(url, body);
    }

    public JsonNode getItemList(String partnerId, String partnerKey, String accessToken, String shopId,
                                int offset, int pageSize, String itemStatus, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");

            List<Long> itemIds = List.of(1000101L, 1000102L);

            resp.put("has_next_page", false).put("total_count", itemIds.size());
            ArrayNode arr = resp.putArray("item");
            for (Long id : itemIds) {
                arr.addObject().put("item_id", id).put("item_status", "NORMAL").put("update_time", Instant.now().getEpochSecond());
            }
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_ITEM_LIST, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&offset=%d&page_size=%d&item_status=%s",
                getHost(isSandbox), PATH_PRODUCT_ITEM_LIST, partnerId, timestamp, accessToken, shopId, sign, offset, pageSize,
                itemStatus != null ? itemStatus : "NORMAL");
        return executeGet(url);
    }

    public JsonNode getItemBaseInfo(String partnerId, String partnerKey, String accessToken, String shopId,
                                    List<Long> itemIdList, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            ArrayNode arr = resp.putArray("item_list");

            for (Long id : (itemIdList != null && !itemIdList.isEmpty() ? itemIdList : List.of(1000101L))) {
                ObjectNode it = arr.addObject();
                it.put("item_id", id);
                it.put("item_name", "Áo Polo Thể Thao FCentric Cao Cấp #" + id);
                it.put("item_sku", "POLO-" + id);
                it.put("description", "Chất vải mè thể thao thoáng khí");
            }
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_BASE_INFO, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String ids = itemIdList.stream().map(String::valueOf).reduce((a, b) -> a + "," + b).orElse("");
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&item_id_list=%s",
                getHost(isSandbox), PATH_PRODUCT_BASE_INFO, partnerId, timestamp, accessToken, shopId, sign, ids);
        return executeGet(url);
    }

    public JsonNode getModelList(String partnerId, String partnerKey, String accessToken, String shopId,
                                 Long itemId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            ArrayNode arr = resp.putArray("model");

            ObjectNode m1 = arr.addObject();
            m1.put("model_id", 2000201L).put("model_sku", "POLO-BLK-M").put("model_name", "Đen / M");
            m1.putObject("price_info").put("current_price", 280000);
            m1.putObject("stock_info_v2").putObject("summary_info").put("total_available_stock", 50);

            ObjectNode m2 = arr.addObject();
            m2.put("model_id", 2000202L).put("model_sku", "POLO-BLK-L").put("model_name", "Đen / L");
            m2.putObject("price_info").put("current_price", 280000);
            m2.putObject("stock_info_v2").putObject("summary_info").put("total_available_stock", 35);
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_MODEL_LIST, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&item_id=%d",
                getHost(isSandbox), PATH_PRODUCT_MODEL_LIST, partnerId, timestamp, accessToken, shopId, sign, itemId);
        return executeGet(url);
    }

    public JsonNode updateStock(String partnerId, String partnerKey, String accessToken, String shopId,
                                Long itemId, Long modelId, int stock, boolean isSandbox) {
        return updateStock(partnerId, partnerKey, accessToken, shopId, itemId, modelId, stock, null, isSandbox);
    }

    public JsonNode updateStock(String partnerId, String partnerKey, String accessToken, String shopId,
                                Long itemId, Long modelId, int stock, String locationId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK-UPDATE-STOCK] Giả lập cập nhật tồn kho Shopee: item={}, model={}, stock={}", itemId, modelId, stock);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_UPDATE_STOCK, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_UPDATE_STOCK, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        Map<String, Object> body = new HashMap<>();
        body.put("item_id", itemId);
        Map<String, Object> stockItem = new HashMap<>();
        stockItem.put("model_id", (modelId != null && modelId > 0) ? modelId : 0L);
        Map<String, Object> sellerStockEntry = new LinkedHashMap<>();
        if (locationId != null && !locationId.isBlank()) {
            sellerStockEntry.put("location_id", locationId.trim());
        }
        sellerStockEntry.put("stock", stock);
        stockItem.put("seller_stock", List.of(sellerStockEntry));
        body.put("stock_list", List.of(stockItem));

        return executePost(url, body);
    }

    public JsonNode updateStockBatch(String partnerId, String partnerKey, String accessToken, String shopId,
                                     Long itemId, List<Map<String, Object>> stockList, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK-UPDATE-STOCK-BATCH] Giả lập cập nhật tồn kho Shopee theo lô: item={}, số SKU={}", itemId, stockList != null ? stockList.size() : 0);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_UPDATE_STOCK, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_UPDATE_STOCK, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        List<Map<String, Object>> normalizedStockList = new ArrayList<>();
        if (stockList != null) {
            for (Map<String, Object> st : stockList) {
                Map<String, Object> copy = new HashMap<>(st);
                if (!copy.containsKey("seller_stock") && copy.containsKey("normal_stock")) {
                    Object normalStock = copy.remove("normal_stock");
                    int sVal = (normalStock instanceof Number) ? ((Number) normalStock).intValue() : 0;
                    copy.put("seller_stock", List.of(Map.of("stock", sVal)));
                }
                normalizedStockList.add(copy);
            }
        }

        Map<String, Object> body = new HashMap<>();
        body.put("item_id", itemId);
        body.put("stock_list", normalizedStockList);

        return executePost(url, body);
    }

    public JsonNode updatePrice(String partnerId, String partnerKey, String accessToken, String shopId,
                                Long itemId, Long modelId, BigDecimal price, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK-UPDATE-PRICE] Giả lập cập nhật giá Shopee: item={}, model={}, price={}", itemId, modelId, price);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_UPDATE_PRICE, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_UPDATE_PRICE, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        Map<String, Object> body = new HashMap<>();
        body.put("item_id", itemId);
        if (modelId != null && modelId > 0) {
            body.put("price_list", List.of(Map.of("model_id", modelId, "original_price", price.doubleValue())));
        } else {
            body.put("price_list", List.of(Map.of("original_price", price.doubleValue())));
        }

        return executePost(url, body);
    }

    public JsonNode updateItem(String partnerId, String partnerKey, String accessToken, String shopId,
                               Map<String, Object> body, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK-UPDATE-ITEM] Giả lập cập nhật thông tin sản phẩm Shopee: item_id={}", body != null ? body.get("item_id") : null);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        long timestamp = Instant.now().getEpochSecond();
        String baseString = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_PRODUCT_UPDATE_ITEM, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, baseString);

        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_PRODUCT_UPDATE_ITEM, partnerId.trim(), timestamp, accessToken.trim(), shopId.trim(), sign);

        return executePost(url, body);
    }

    // =========================================================================
    // 4. LOGISTICS & FULFILLMENT APIS
    // =========================================================================

    public JsonNode getShippingParameter(String partnerId, String partnerKey, String accessToken, String shopId,
                                         String orderSn, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            resp.putArray("dropoff");
            ObjectNode pickup = resp.putObject("pickup");
            ArrayNode arr = pickup.putArray("address_list");
            arr.addObject().put("address_id", 1001).put("address", "Kho Tổng FCentric, Lô CN-02 KCN Nam Từ Liêm, Hà Nội");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_SHIPPING_PARAM, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&order_sn=%s",
                getHost(isSandbox), PATH_SHIPPING_PARAM, partnerId, timestamp, accessToken, shopId, sign, orderSn);
        return executeGet(url);
    }

    public JsonNode shipOrder(String partnerId, String partnerKey, String accessToken, String shopId,
                              String orderSn, String pickupOrDropoff, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK-SHIP] Giả lập ship order #{} kiểu={}", orderSn, pickupOrDropoff);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        String url = buildSignedShopUrl(PATH_SHIP_ORDER, partnerId, partnerKey, accessToken, shopId, isSandbox);
        Map<String, Object> body = new HashMap<>();
        body.put("order_sn", orderSn);
        if ("pickup".equalsIgnoreCase(pickupOrDropoff)) {
            body.put("pickup", Map.of("address_id", 1001));
        } else {
            body.put("dropoff", Map.of());
        }

        return executePost(url, body);
    }

    /**
     * Tự động đọc {@code get_shipping_parameter} để chọn đúng chế độ {@code pickup} (kèm {@code address_id},
     * {@code pickup_time_id}) hoặc {@code dropoff} khi gọi {@code ship_order}, có tự động thử chế độ còn lại nếu lỗi.
     */
    public JsonNode shipOrderAuto(String partnerId, String partnerKey, String accessToken, String shopId,
                                  String orderSn, boolean isSandbox) {
        return shipOrderAuto(partnerId, partnerKey, accessToken, shopId, orderSn, null, isSandbox);
    }

    public JsonNode shipOrderAuto(String partnerId, String partnerKey, String accessToken, String shopId,
                                  String orderSn, Long preferredAddressId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK-SHIP] Giả lập shipOrderAuto #{}", orderSn);
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }

        Map<String, Object> pickupPayload = null;
        boolean hasDropoff = false;
        try {
            JsonNode paramRes = getShippingParameter(partnerId, partnerKey, accessToken, shopId, orderSn, isSandbox);
            JsonNode resp = paramRes != null ? paramRes.path("response") : null;
            if (resp != null && !resp.isMissingNode()) {
                JsonNode addressList = resp.path("pickup").path("address_list");
                if (addressList.isArray() && !addressList.isEmpty()) {
                    JsonNode chosenAddr = chonDiaChiPickupShopee(addressList, preferredAddressId);
                    if (chosenAddr != null && chosenAddr.hasNonNull("address_id")) {
                        Map<String, Object> p = new HashMap<>();
                        p.put("address_id", chosenAddr.path("address_id").asLong());
                        JsonNode timeSlotList = chosenAddr.path("time_slot_list");
                        if (timeSlotList.isArray() && !timeSlotList.isEmpty()) {
                            String timeId = timeSlotList.get(0).path("pickup_time_id").asText("");
                            if (!timeId.isBlank()) {
                                p.put("pickup_time_id", timeId);
                            }
                        }
                        pickupPayload = p;
                    }
                }
                hasDropoff = resp.has("dropoff") && !resp.path("dropoff").isMissingNode() && !resp.path("dropoff").isNull();
            }
        } catch (Exception ex) {
            log.info("[SHOPEE-SHIP] Không đọc được shipping_parameter cho đơn {}: {}", orderSn, ex.getMessage());
        }

        String url = buildSignedShopUrl(PATH_SHIP_ORDER, partnerId, partnerKey, accessToken, shopId, isSandbox);
        boolean uuTienPickup = pickupPayload != null && !hasDropoff;

        if (uuTienPickup || pickupPayload != null) {
            Map<String, Object> body = new HashMap<>();
            body.put("order_sn", orderSn);
            body.put("pickup", pickupPayload);
            JsonNode res = executePost(url, body);
            if (laKetQuaShipOrderThanhCong(res)) {
                return res;
            }
            if (hasDropoff) {
                Map<String, Object> dropBody = Map.of("order_sn", orderSn, "dropoff", Map.of());
                return executePost(url, dropBody);
            }
            return res;
        }

        Map<String, Object> dropBody = Map.of("order_sn", orderSn, "dropoff", Map.of());
        return executePost(url, dropBody);
    }

    private static JsonNode chonDiaChiPickupShopee(JsonNode addressList, Long preferredAddressId) {
        if (preferredAddressId != null) {
            for (JsonNode addr : addressList) {
                if (addr.path("address_id").asLong(-1L) == preferredAddressId) {
                    return addr;
                }
            }
        }
        for (JsonNode addr : addressList) {
            JsonNode flags = addr.path("address_flag");
            if (flags.isArray()) {
                for (JsonNode f : flags) {
                    if ("pickup_address".equalsIgnoreCase(f.asText())) {
                        return addr;
                    }
                }
            }
        }
        return addressList.get(0);
    }

    private static boolean laKetQuaShipOrderThanhCong(JsonNode res) {
        if (res == null) return false;
        String err = res.path("error").asText("");
        String msg = res.path("message").asText("").toLowerCase(Locale.ROOT);
        return err.isBlank() || msg.contains("already") || msg.contains("processed") || err.contains("already");
    }

    public JsonNode getAddressList(String partnerId, String partnerKey, String accessToken, String shopId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ArrayNode arr = res.putObject("response").putArray("address_list");
            arr.addObject().put("address_id", 1001L).put("address", "Kho Tổng FCentric (Mặc định)").put("state", "Hà Nội");
            return res;
        }
        String url = buildSignedShopUrl(PATH_GET_ADDRESS_LIST, partnerId, partnerKey, accessToken, shopId, isSandbox);
        return executeGet(url);
    }

    public JsonNode getWarehouseDetail(String partnerId, String partnerKey, String accessToken, String shopId, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putArray("response").addObject()
                    .put("warehouse_id", "1001")
                    .put("warehouse_name", "Kho mặc định Shopee")
                    .put("warehouse_type", 1);
            return res;
        }
        String url = buildSignedShopUrl(PATH_GET_WAREHOUSE_DETAIL, partnerId, partnerKey, accessToken, shopId, isSandbox);
        return executeGet(url);
    }

    public JsonNode getTrackingNumber(String partnerId, String partnerKey, String accessToken, String shopId,
                                      String orderSn, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response").put("tracking_number", "SPXVN" + orderSn);
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_TRACKING_NUMBER, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&order_sn=%s",
                getHost(isSandbox), PATH_TRACKING_NUMBER, partnerId, timestamp, accessToken, shopId, sign, orderSn);
        return executeGet(url);
    }

    public JsonNode getTrackingInfo(String partnerId, String partnerKey, String accessToken, String shopId,
                                    String orderSn, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            ArrayNode arr = resp.putArray("tracking_info");
            arr.addObject().put("update_time", Instant.now().getEpochSecond() - 3600)
                    .put("description", "Đơn hàng đã được bàn giao cho đơn vị vận chuyển Shopee Xpress")
                    .put("logistics_status", "LOGISTICS_PICKED_UP");
            arr.addObject().put("update_time", Instant.now().getEpochSecond() - 7200)
                    .put("description", "Người bán đang chuẩn bị hàng")
                    .put("logistics_status", "LOGISTICS_READY");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_TRACKING_INFO, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&order_sn=%s",
                getHost(isSandbox), PATH_TRACKING_INFO, partnerId, timestamp, accessToken, shopId, sign, orderSn);
        return executeGet(url);
    }

    public JsonNode createShippingDocument(String partnerId, String partnerKey, String accessToken, String shopId,
                                           String orderSn, boolean isSandbox) {
        return createShippingDocument(partnerId, partnerKey, accessToken, shopId, orderSn, null, "THERMAL_AIR_WAYBILL", isSandbox);
    }

    public JsonNode createShippingDocument(String partnerId, String partnerKey, String accessToken, String shopId,
                                           String orderSn, String trackingNumber, String documentType, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK-DOC] Giả lập tạo phiếu vận đơn Shopee cho #{} (tracking={})", orderSn, trackingNumber);
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response").put("status", "READY");
            return res;
        }

        String url = buildSignedShopUrl(PATH_CREATE_DOC, partnerId, partnerKey, accessToken, shopId, isSandbox);
        String docType = (documentType != null && !documentType.isBlank()) ? documentType : "THERMAL_AIR_WAYBILL";
        Map<String, Object> orderEntry = new HashMap<>();
        orderEntry.put("order_sn", orderSn);
        if (trackingNumber != null && !trackingNumber.isBlank()) {
            orderEntry.put("tracking_number", trackingNumber.trim());
        }
        Map<String, Object> body = Map.of(
                "order_list", List.of(orderEntry),
                "shipping_document_type", docType
        );
        return executePost(url, body);
    }

    public JsonNode getShippingDocumentResult(String partnerId, String partnerKey, String accessToken, String shopId,
                                             String orderSn, boolean isSandbox) {
        return getShippingDocumentResult(partnerId, partnerKey, accessToken, shopId, orderSn, "THERMAL_AIR_WAYBILL", isSandbox);
    }

    public JsonNode getShippingDocumentResult(String partnerId, String partnerKey, String accessToken, String shopId,
                                             String orderSn, String documentType, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response").put("status", "READY");
            return res;
        }

        String url = buildSignedShopUrl(PATH_GET_DOC_RESULT, partnerId, partnerKey, accessToken, shopId, isSandbox);
        String docType = (documentType != null && !documentType.isBlank()) ? documentType : "THERMAL_AIR_WAYBILL";
        Map<String, Object> body = Map.of(
                "order_list", List.of(Map.of("order_sn", orderSn)),
                "shipping_document_type", docType
        );
        return executePost(url, body);
    }

    /**
     * Lấy thông tin dữ liệu vận đơn Shopee (`/api/v2/logistics/get_shipping_document_data_info`),
     * gồm mã vận đơn thật, đơn vị vận chuyển, mã chia chọn tuyến (`recipient_sort_code`) và cờ COD.
     */
    public JsonNode getShippingDocumentDataInfo(String partnerId, String partnerKey, String accessToken, String shopId,
                                                String orderSn, String packageNumber, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode info = res.putObject("response").putObject("shipping_document_info");
            info.put("tracking_number", "SPXVN05" + (orderSn != null ? orderSn.replaceAll("[^0-9]", "") : "123456"));
            info.put("shipping_carrier", "Shopee Xpress (SPX VN)");
            info.put("cod", true);
            info.put("cod_amount", 320000);
            ObjectNode sortCode = info.putObject("recipient_sort_code");
            sortCode.put("first_recipient_sort_code", "1-SGN-HUB");
            sortCode.put("second_recipient_sort_code", "SG100A");
            sortCode.put("third_recipient_sort_code", "00-01");
            return res;
        }

        String url = buildSignedShopUrl(PATH_GET_DOC_DATA_INFO, partnerId, partnerKey, accessToken, shopId, isSandbox);
        Map<String, Object> body = new HashMap<>();
        body.put("order_sn", orderSn);
        if (packageNumber != null && !packageNumber.isBlank()) {
            body.put("package_number", packageNumber.trim());
        }
        return executePost(url, body);
    }

    public JsonNode getShippingDocumentDataInfo(String orderSn, String packageNumber) {
        return getShippingDocumentDataInfo(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, packageNumber, this.isSandbox);
    }

    // =========================================================================
    // 5. PAYMENT & ESCROW APIS
    // =========================================================================

    public JsonNode getEscrowDetail(String partnerId, String partnerKey, String accessToken, String shopId,
                                    String orderSn, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            ObjectNode resp = res.putObject("response");
            resp.put("order_sn", orderSn)
                    .put("buyer_total_amount", 350000.0)
                    .put("original_price", 320000.0)
                    .put("seller_discount", 0.0)
                    .put("shopee_discount", 20000.0);
            ObjectNode income = resp.putObject("order_income");
            income.put("escrow_amount", 325000.0)
                    .put("buyer_paid_shipping_fee", 30000.0)
                    .put("shopee_shipping_rebate", 10000.0)
                    .put("commission_fee", 10000.0)
                    .put("service_fee", 15000.0)
                    .put("transaction_fee", 8000.0)
                    .put("cross_border_tax", 0.0);
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_ESCROW_DETAIL, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&order_sn=%s",
                getHost(isSandbox), PATH_ESCROW_DETAIL, partnerId, timestamp, accessToken, shopId, sign, orderSn);
        return executeGet(url);
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private String buildSignedShopUrl(String path, String partnerId, String partnerKey,
                                      String accessToken, String shopId, boolean isSandbox) {
        long timestamp = Instant.now().getEpochSecond();
        String pId = partnerId != null ? partnerId.trim() : "";
        String aToken = accessToken != null ? accessToken.trim() : "";
        String sId = shopId != null ? shopId.trim() : "";
        String base = ShopeeSignatureHelper.buildShopBaseString(pId, path, timestamp, aToken, sId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        return String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), path, pId, timestamp, aToken, sId, sign);
    }

    public static boolean laJsonLoiShopee(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return false;
        String text = new String(bytes, StandardCharsets.UTF_8).trim();
        return text.startsWith("{") && (text.contains("\"error\"") || text.contains("\"message\""));
    }

    private boolean isMockCredentials(String partnerId, String partnerKey) {
        return partnerId == null || partnerId.isBlank()
                || partnerKey == null || partnerKey.isBlank()
                || partnerKey.contains("mock")
                || partnerId.contains("mock");
    }

    private JsonNode executeGet(String url) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set(HttpHeaders.USER_AGENT, "ShopeeOpenAPI/2.0");
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (HttpStatusCodeException ex) {
            log.warn("[SHOPEE-CLIENT-GET] Lỗi HTTP {} khi gọi GET {}: {}", ex.getStatusCode(), url, ex.getResponseBodyAsString());
            try {
                return objectMapper.readTree(ex.getResponseBodyAsString());
            } catch (Exception parseEx) {
                return objectMapper.createObjectNode().put("error", "HTTP_" + ex.getStatusCode().value()).put("message", ex.getResponseBodyAsString());
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-CLIENT-GET] Lỗi khi gọi GET {}: {}", url, ex.getMessage());
            return objectMapper.createObjectNode().put("error", "API_ERROR").put("message", ex.getMessage());
        }
    }

    private JsonNode executePost(String url, Object body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set(HttpHeaders.USER_AGENT, "ShopeeOpenAPI/2.0");
            HttpEntity<Object> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (HttpStatusCodeException ex) {
            log.warn("[SHOPEE-CLIENT-POST] Lỗi HTTP {} khi gọi POST {}: {}", ex.getStatusCode(), url, ex.getResponseBodyAsString());
            try {
                return objectMapper.readTree(ex.getResponseBodyAsString());
            } catch (Exception parseEx) {
                return objectMapper.createObjectNode().put("error", "HTTP_" + ex.getStatusCode().value()).put("message", ex.getResponseBodyAsString());
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-CLIENT-POST] Lỗi khi gọi POST {}: {}", url, ex.getMessage());
            return objectMapper.createObjectNode().put("error", "API_ERROR").put("message", ex.getMessage());
        }
    }

    private JsonNode executeMultipartPost(String url, byte[] imageBytes, String fileName) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set(HttpHeaders.USER_AGENT, "ShopeeOpenAPI/2.0");

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(imageBytes != null ? imageBytes : new byte[0]) {
                @Override
                public String getFilename() {
                    return (fileName != null && !fileName.isBlank()) ? fileName : "product.jpg";
                }
            };
            body.add("image", fileResource);

            HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (HttpStatusCodeException ex) {
            log.warn("[SHOPEE-CLIENT-UPLOAD] Lỗi HTTP {} khi upload ảnh {}: {}", ex.getStatusCode(), url, ex.getResponseBodyAsString());
            try {
                return objectMapper.readTree(ex.getResponseBodyAsString());
            } catch (Exception parseEx) {
                return objectMapper.createObjectNode().put("error", "HTTP_" + ex.getStatusCode().value()).put("message", ex.getResponseBodyAsString());
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-CLIENT-UPLOAD] Lỗi khi upload ảnh {}: {}", url, ex.getMessage());
            return objectMapper.createObjectNode().put("error", "API_ERROR").put("message", ex.getMessage());
        }
    }

    // =========================================================================
    // CONVENIENCE OVERLOAD METHODS DÀNH CHO INSTANCE ĐÃ CẤU HÌNH (STATEFUL)
    // =========================================================================

    private String pIdStr() {
        return String.valueOf(this.partnerId != null ? this.partnerId : 1000888L);
    }

    private String sIdStr() {
        return String.valueOf(this.shopId != null ? this.shopId : 0L);
    }

    private String pKeyStr() {
        return this.partnerKey != null ? this.partnerKey : "";
    }

    private String aTokenStr() {
        return this.accessToken != null ? this.accessToken : "";
    }

    public JsonNode cancelOrder(String orderSn, String cancelReason) {
        return cancelOrder(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, cancelReason, (List<Map<String, Object>>) null, this.isSandbox);
    }

    public JsonNode cancelOrder(String orderSn, String cancelReason, List<Map<String, Object>> itemList) {
        return cancelOrder(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, cancelReason, itemList, this.isSandbox);
    }

    public JsonNode handleBuyerCancellation(String orderSn, String operation) {
        return handleBuyerCancellation(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, operation, this.isSandbox);
    }

    public JsonNode setOrderNote(String orderSn, String note) {
        return setOrderNote(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, note, this.isSandbox);
    }

    public JsonNode setOrderNote(String partnerId, String partnerKey, String accessToken, String shopId,
                                String orderSn, String note, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            return objectMapper.createObjectNode().put("error", "").put("message", "success");
        }
        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_ORDER_SET_NOTE, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_ORDER_SET_NOTE, partnerId, timestamp, accessToken, shopId, sign);
        Map<String, Object> body = Map.of("order_sn", orderSn, "note", note != null ? note : "");
        return executePost(url, body);
    }

    public JsonNode getShippingParameter(String orderSn) {
        return getShippingParameter(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, this.isSandbox);
    }

    public JsonNode shipOrder(String orderSn, String pickupOrDropoff) {
        return shipOrder(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, pickupOrDropoff, this.isSandbox);
    }

    public JsonNode shipOrderAuto(String orderSn) {
        return shipOrderAuto(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, this.isSandbox);
    }

    public JsonNode shipOrderAuto(String orderSn, Long preferredAddressId) {
        return shipOrderAuto(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, preferredAddressId, this.isSandbox);
    }

    public JsonNode createShippingDocument(String orderSn, String trackingNumber, String documentType) {
        return createShippingDocument(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, trackingNumber, documentType, this.isSandbox);
    }

    public JsonNode getOrderDetail(String orderSn) {
        return getOrderDetail(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), List.of(orderSn), this.isSandbox);
    }

    public JsonNode getAddressList() {
        return getAddressList(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), this.isSandbox);
    }

    public JsonNode getWarehouseDetail() {
        return getWarehouseDetail(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), this.isSandbox);
    }

    public JsonNode getTrackingNumber(String orderSn) {
        return getTrackingNumber(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, this.isSandbox);
    }

    public JsonNode getTrackingInfo(String orderSn) {
        return getTrackingInfo(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, this.isSandbox);
    }

    public byte[] downloadShippingDocument(String orderSn) {
        return downloadShippingDocument(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, this.isSandbox);
    }

    public byte[] downloadShippingDocument(String partnerId, String partnerKey, String accessToken, String shopId,
                                          String orderSn, boolean isSandbox) {
        return downloadShippingDocument(partnerId, partnerKey, accessToken, shopId, orderSn, isSandbox, false);
    }

    public byte[] downloadShippingDocument(String partnerId, String partnerKey, String accessToken, String shopId,
                                          String orderSn, boolean isSandbox, boolean daChuanBiHang) {
        if (isMockCredentials(partnerId, partnerKey)) {
            String mockHtml = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Shopee AWB " + orderSn + "</title>"
                    + "<style>@page{size:100mm 150mm;margin:0;}body{font-family:sans-serif;margin:10mm;text-align:center;}"
                    + ".box{border:2px solid #000;padding:10px;border-radius:4px;}.barcode{font-family:monospace;font-size:24px;letter-spacing:4px;font-weight:bold;margin:15px 0;}"
                    + "</style></head><body><div class='box'><h2>SHOPEE EXPRESS (SPX VN)</h2>"
                    + "<div class='barcode'>*SPX" + orderSn + "*</div>"
                    + "<p>Mã đơn hàng: <strong>" + orderSn + "</strong></p>"
                    + "<p>Người nhận: <strong>Khách hàng Shopee (09***382)</strong></p>"
                    + "<p>Địa chỉ: <strong>Theo bưu kiện Shopee</strong></p>"
                    + "</div></body></html>";
            return mockHtml.getBytes(StandardCharsets.UTF_8);
        }
        try {
            // Bước 0: Chỉ gọi shipOrderAuto nếu đơn chưa có mã vận đơn/chưa chuẩn bị hàng trên Shopee (tránh lỗi lặp ship_order)
            if (!daChuanBiHang) {
                try {
                    shipOrderAuto(partnerId, partnerKey, accessToken, shopId, orderSn, isSandbox);
                } catch (Exception shipEx) {
                    log.info("[SHOPEE-DOC] shipOrderAuto phản hồi: {}", shipEx.getMessage());
                }
            }

            // Bước 1: Lấy tracking_number (dừng ngay nếu sàn trả lỗi rõ ràng để tránh spam API)
            String trackingNumber = layTrackingNumberShopee(partnerId, partnerKey, accessToken, shopId, orderSn, isSandbox);

            // Bước 2-4: Tạo bản in (create_shipping_document) -> Chờ READY -> Tải file PDF
            for (String docType : List.of("THERMAL_AIR_WAYBILL", "NORMAL_AIR_WAYBILL")) {
                byte[] downloaded = taoVaTaiVanDonTheoLoai(
                        partnerId, partnerKey, accessToken, shopId, orderSn, trackingNumber, docType, isSandbox);
                if (downloaded.length > 50 && !laJsonLoiShopee(downloaded)) {
                    return downloaded;
                }
            }
            return new byte[0];
        } catch (Exception ex) {
            log.warn("[SHOPEE-DOWNLOAD-DOC] Lỗi khi tải tài liệu in vận đơn: {}", ex.getMessage());
            return new byte[0];
        }
    }

    private String layTrackingNumberShopee(String partnerId, String partnerKey, String accessToken, String shopId,
                                           String orderSn, boolean isSandbox) {
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                JsonNode trackRes = getTrackingNumber(partnerId, partnerKey, accessToken, shopId, orderSn, isSandbox);
                if (trackRes != null) {
                    String err = trackRes.path("error").asText("").trim();
                    String trackingNo = trackRes.path("response").path("tracking_number").asText("").trim();
                    if (!trackingNo.isBlank()) {
                        return trackingNo;
                    }
                    if (!err.isBlank()) {
                        log.debug("[SHOPEE-DOC] getTrackingNumber trả lỗi '{}' cho {} -> dừng retry", err, orderSn);
                        break;
                    }
                }
                if (attempt == 0) {
                    Thread.sleep(400);
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception ex) {
                log.debug("[SHOPEE-DOC] getTrackingNumber lần {} thất bại cho {}: {}", attempt + 1, orderSn, ex.getMessage());
                break;
            }
        }
        return "";
    }

    private byte[] taoVaTaiVanDonTheoLoai(String partnerId, String partnerKey, String accessToken, String shopId,
                                          String orderSn, String trackingNumber, String docType, boolean isSandbox) {
        boolean createdOrExists = false;
        try {
            JsonNode createRes = createShippingDocument(
                    partnerId, partnerKey, accessToken, shopId, orderSn, trackingNumber, docType, isSandbox);
            createdOrExists = laCreateDocThanhCongHoacDaTonTai(createRes);
            if (!createdOrExists && trackingNumber != null && !trackingNumber.isBlank() && coTheThuKhongTracking(createRes)) {
                log.info("[SHOPEE-DOC] createShippingDocument kèm tracking [{}] chưa đạt ({}), thử lại không truyền tracking_number...",
                        trackingNumber, createRes != null ? createRes.toString() : "null");
                JsonNode retryRes = createShippingDocument(partnerId, partnerKey, accessToken, shopId, orderSn, null, docType, isSandbox);
                createdOrExists = laCreateDocThanhCongHoacDaTonTai(retryRes);
            }
        } catch (Exception ex) {
            log.info("[SHOPEE-DOC] createShippingDocument ({}) phản hồi: {}", docType, ex.getMessage());
        }

        if (!createdOrExists) {
            log.debug("[SHOPEE-DOC] Bỏ qua polling getShippingDocumentResult ({}) cho đơn {} do createShippingDocument thất bại", docType, orderSn);
            return new byte[0];
        }

        // Kiểm tra trạng thái sẵn sàng (tối đa 4 lần, dừng ngay khi READY, FAILED hoặc có lỗi JSON)
        boolean ready = false;
        for (int i = 0; i < 4; i++) {
            try {
                JsonNode statusRes = getShippingDocumentResult(
                        partnerId, partnerKey, accessToken, shopId, orderSn, docType, isSandbox);
                if (statusRes != null) {
                    String topErr = statusRes.path("error").asText("").trim();
                    if (!topErr.isBlank()) {
                        log.warn("[SHOPEE-DOC] getShippingDocumentResult ({}) lỗi '{}' cho đơn {} -> dừng polling", docType, topErr, orderSn);
                        return new byte[0];
                    }
                    JsonNode firstResult = statusRes.path("response").path("result_list").path(0);
                    String failErr = firstResult.path("fail_error").asText("").trim();
                    if (!failErr.isBlank()) {
                        log.warn("[SHOPEE-DOC] getShippingDocumentResult ({}) fail_error='{}' cho đơn {} -> dừng polling", docType, failErr, orderSn);
                        return new byte[0];
                    }
                    String st = statusRes.path("response").path("status").asText("");
                    if (st.isBlank() && statusRes.path("response").path("result_list").isArray()) {
                        st = firstResult.path("status").asText("");
                    }
                    if ("READY".equalsIgnoreCase(st)) {
                        ready = true;
                        break;
                    }
                    if ("FAILED".equalsIgnoreCase(st)) {
                        log.warn("[SHOPEE-DOC] Shopee báo FAILED khi dựng vận đơn {} cho đơn {}: {}", docType, orderSn, statusRes);
                        return new byte[0];
                    }
                }
                if (i < 3) {
                    Thread.sleep(500L + i * 200L);
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception ex) {
                break;
            }
        }

        if (!ready) {
            log.debug("[SHOPEE-DOC] Vận đơn {} của đơn {} chưa READY sau tối đa 4 lần kiểm tra -> bỏ qua download_shipping_document", docType, orderSn);
            return new byte[0];
        }

        try {
            String url = buildSignedShopUrl(PATH_DOWNLOAD_DOC, partnerId, partnerKey, accessToken, shopId, isSandbox);
            Map<String, Object> body = Map.of(
                    "shipping_document_type", docType,
                    "order_list", List.of(Map.of("order_sn", orderSn))
            );
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_PDF, MediaType.APPLICATION_OCTET_STREAM, MediaType.ALL));
            headers.set(HttpHeaders.USER_AGENT, "ShopeeOpenAPI/2.0");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<byte[]> res = restTemplate.exchange(url, HttpMethod.POST, entity, byte[].class);
            byte[] extracted = extractPdfFromZipOrRaw(res.getBody() != null ? res.getBody() : new byte[0]);
            if (laJsonLoiShopee(extracted)) {
                log.warn("[SHOPEE-DOWNLOAD-DOC] Shopee trả về JSON lỗi ({}): {}",
                        docType, new String(extracted, StandardCharsets.UTF_8));
                return new byte[0];
            }
            return extracted;
        } catch (HttpStatusCodeException ex) {
            log.warn("[SHOPEE-DOWNLOAD-DOC] HTTP {} khi tải vận đơn {} đơn {}: {}",
                    ex.getStatusCode(), docType, orderSn, ex.getResponseBodyAsString());
            return new byte[0];
        } catch (Exception ex) {
            log.warn("[SHOPEE-DOWNLOAD-DOC] Lỗi khi tải vận đơn {} đơn {}: {}", docType, orderSn, ex.getMessage());
            return new byte[0];
        }
    }

    private static boolean laCreateDocThanhCongHoacDaTonTai(JsonNode res) {
        if (res == null) return false;
        String err = res.path("error").asText("").trim().toLowerCase(Locale.ROOT);
        String msg = res.path("message").asText("").trim().toLowerCase(Locale.ROOT);
        if (!err.isBlank()) {
            return msg.contains("already") || err.contains("already") || msg.contains("created");
        }
        JsonNode resultList = res.path("response").path("result_list");
        if (resultList.isArray() && !resultList.isEmpty()) {
            String failErr = resultList.get(0).path("fail_error").asText("").trim().toLowerCase(Locale.ROOT);
            String failMsg = resultList.get(0).path("fail_message").asText("").trim().toLowerCase(Locale.ROOT);
            return failErr.isBlank() || failErr.contains("already") || failMsg.contains("already");
        }
        return true;
    }

    private static boolean coTheThuKhongTracking(JsonNode res) {
        if (res == null) return false;
        String err = res.path("error").asText("").toLowerCase(Locale.ROOT);
        if (err.contains("auth") || err.contains("denied") || err.contains("not_found") || err.contains("http_401") || err.contains("http_403")) {
            return false;
        }
        String text = res.toString().toLowerCase(Locale.ROOT);
        return text.contains("tracking");
    }

    private byte[] extractPdfFromZipOrRaw(byte[] bytes) {
        if (bytes == null || bytes.length < 4) {
            return bytes;
        }
        // Kiểm tra nếu là tệp ZIP (magic bytes PK: 0x50, 0x4B)
        if (bytes[0] == 0x50 && bytes[1] == 0x4B) {
            try (java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(bytes))) {
                java.util.zip.ZipEntry entry;
                while ((entry = zis.getNextEntry()) != null) {
                    if (entry.getName().toLowerCase().endsWith(".pdf")) {
                        log.info("[SHOPEE-ZIP] Đã trích xuất PDF vận đơn thành công từ tệp ZIP Shopee: {}", entry.getName());
                        return zis.readAllBytes();
                    }
                }
            } catch (Exception ex) {
                log.warn("[SHOPEE-ZIP] Lỗi khi giải nén tài liệu vận đơn ZIP: {}", ex.getMessage());
            }
        }
        return bytes;
    }

    public JsonNode getEscrowDetail(String orderSn) {
        return getEscrowDetail(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, this.isSandbox);
    }

    public JsonNode getItemList(int offset, int pageSize, String itemStatus) {
        return getItemList(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), offset, pageSize, itemStatus, this.isSandbox);
    }

    public JsonNode getItemBaseInfo(List<Long> itemIds) {
        return getItemBaseInfo(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemIds, this.isSandbox);
    }

    public JsonNode updateStock(Long itemId, Long modelId, int stock) {
        return updateStock(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemId, modelId, stock, null, this.isSandbox);
    }

    public JsonNode updateStock(Long itemId, Long modelId, int stock, String locationId) {
        return updateStock(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemId, modelId, stock, locationId, this.isSandbox);
    }

    public JsonNode updateStockBatch(Long itemId, List<Map<String, Object>> stockList) {
        return updateStockBatch(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemId, stockList, this.isSandbox);
    }

    public JsonNode updatePrice(Long itemId, Long modelId, BigDecimal price) {
        return updatePrice(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemId, modelId, price, this.isSandbox);
    }

    public JsonNode updateItem(Map<String, Object> body) {
        return updateItem(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), body, this.isSandbox);
    }

    public JsonNode uploadImage(byte[] imageBytes, String fileName) {
        return uploadImage(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), imageBytes, fileName, this.isSandbox);
    }

    public JsonNode getLogisticsChannelList() {
        return getLogisticsChannelList(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), this.isSandbox);
    }

    public JsonNode getCategoryList(String language) {
        return getCategoryList(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), language, this.isSandbox);
    }

    public JsonNode getCategoryList() {
        return getCategoryList("vi");
    }

    public JsonNode getAttributes(long categoryId, String language) {
        return getAttributes(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), categoryId, language, this.isSandbox);
    }

    public JsonNode getAttributeTree(List<Long> categoryIdList, String language) {
        return getAttributeTree(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), categoryIdList, language, this.isSandbox);
    }

    public JsonNode getAttributeTree(long categoryId) {
        return getAttributeTree(List.of(categoryId), "vi");
    }

    public JsonNode deleteItem(long itemId) {
        return deleteItem(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemId, this.isSandbox);
    }

    public JsonNode addItem(Map<String, Object> body) {
        return addItem(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), body, this.isSandbox);
    }

    public JsonNode initTierVariation(Map<String, Object> body) {
        return initTierVariation(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), body, this.isSandbox);
    }

    public JsonNode getModelList(Long itemId) {
        return getModelList(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemId, this.isSandbox);
    }

    public JsonNode getAccessToken(String code, long shopId) {
        return getToken(pIdStr(), pKeyStr(), code, String.valueOf(shopId), this.isSandbox);
    }

    public JsonNode refreshAccessToken(String refreshToken, long shopId) {
        return refreshToken(pIdStr(), pKeyStr(), refreshToken, String.valueOf(shopId), this.isSandbox);
    }

    public JsonNode getShopInfo() {
        return getShopInfo(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), this.isSandbox);
    }

    public JsonNode getShopsByPartner(int pageNo, int pageSize) {
        return getShopsByPartner(pIdStr(), pKeyStr(), pageNo, pageSize, this.isSandbox);
    }

    public JsonNode getShopsByPartner() {
        return getShopsByPartner(1, 50);
    }

    public String generateAuthUrl(String redirectUri) {
        return generateAuthUrl(pIdStr(), pKeyStr(), redirectUri, this.isSandbox);
    }
}
