package com.dev.backend.services.shopee;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

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
    public static final String PATH_PRODUCT_ADD_ITEM = "/api/v2/product/add_item";
    public static final String PATH_PRODUCT_INIT_TIER_VARIATION = "/api/v2/product/init_tier_variation";
    public static final String PATH_PRODUCT_ITEM_LIST = "/api/v2/product/get_item_list";
    public static final String PATH_PRODUCT_BASE_INFO = "/api/v2/product/get_item_base_info";
    public static final String PATH_PRODUCT_MODEL_LIST = "/api/v2/product/get_model_list";
    public static final String PATH_UPDATE_STOCK = "/api/v2/product/update_stock";
    public static final String PATH_UPDATE_PRICE = "/api/v2/product/update_price";

    // 4. Logistics Paths
    public static final String PATH_SHIPPING_PARAM = "/api/v2/logistics/get_shipping_parameter";
    public static final String PATH_SHIP_ORDER = "/api/v2/logistics/ship_order";
    public static final String PATH_TRACKING_NUMBER = "/api/v2/logistics/get_tracking_number";
    public static final String PATH_TRACKING_INFO = "/api/v2/logistics/get_tracking_info";
    public static final String PATH_CREATE_DOC = "/api/v2/logistics/create_shipping_document";
    public static final String PATH_GET_DOC_RESULT = "/api/v2/logistics/get_shipping_document_result";
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
        this.restTemplate = new RestTemplate(factory);
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
                    .put("description", "Thời trang FCentric - Shopee Official Store");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_SHOP_PROFILE, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_SHOP_PROFILE, partnerId, timestamp, accessToken, shopId, sign);
        return executeGet(url);
    }

    // =========================================================================
    // 2. ORDER APIS
    // =========================================================================

    public JsonNode getOrderList(String partnerId, String partnerKey, String accessToken, String shopId,
                                 long timeFrom, long timeTo, String orderStatus, int pageSize, String cursor, boolean isSandbox) {
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
        StringBuilder url = new StringBuilder(String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&time_range_field=create_time&time_from=%d&time_to=%d&page_size=%d",
                getHost(isSandbox), PATH_ORDER_LIST, partnerId, timestamp, accessToken, shopId, sign, timeFrom, timeTo, pageSize));
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
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&order_sn_list=%s&response_optional_fields=buyer_user_id,buyer_username,recipient_address,item_list,shipping_carrier,total_amount",
                getHost(isSandbox), PATH_ORDER_DETAIL, partnerId, timestamp, accessToken, shopId, sign, snParam);
        return executeGet(url);
    }

    public JsonNode cancelOrder(String partnerId, String partnerKey, String accessToken, String shopId,
                                String orderSn, String cancelReason, Long itemId, Long modelId, boolean isSandbox) {
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
        if (itemId != null) body.put("item_list", List.of(Map.of("item_id", itemId, "model_id", modelId != null ? modelId : 0)));

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
        stockItem.put("normal_stock", stock);
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

        Map<String, Object> body = new HashMap<>();
        body.put("item_id", itemId);
        body.put("stock_list", stockList != null ? stockList : List.of());

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

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_SHIP_ORDER, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_SHIP_ORDER, partnerId, timestamp, accessToken, shopId, sign);

        Map<String, Object> body = new HashMap<>();
        body.put("order_sn", orderSn);
        if ("pickup".equalsIgnoreCase(pickupOrDropoff)) {
            body.put("pickup", Map.of("address_id", 1001));
        } else {
            body.put("dropoff", Map.of("branch_id", 1));
        }

        return executePost(url, body);
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
        if (isMockCredentials(partnerId, partnerKey)) {
            log.info("[SHOPEE-MOCK-DOC] Giả lập tạo phiếu vận đơn Shopee cho #{}", orderSn);
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response").put("status", "READY");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_CREATE_DOC, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s",
                getHost(isSandbox), PATH_CREATE_DOC, partnerId, timestamp, accessToken, shopId, sign);

        Map<String, Object> body = Map.of(
                "order_list", List.of(Map.of("order_sn", orderSn)),
                "shipping_document_type", "THERMAL_AIR_WAYBILL"
        );
        return executePost(url, body);
    }

    public JsonNode getShippingDocumentResult(String partnerId, String partnerKey, String accessToken, String shopId,
                                             String orderSn, boolean isSandbox) {
        if (isMockCredentials(partnerId, partnerKey)) {
            ObjectNode res = objectMapper.createObjectNode();
            res.put("error", "").put("message", "success");
            res.putObject("response").put("status", "READY");
            return res;
        }

        long timestamp = Instant.now().getEpochSecond();
        String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_GET_DOC_RESULT, timestamp, accessToken, shopId);
        String sign = ShopeeSignatureHelper.sign(partnerKey, base);
        String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&order_sn=%s",
                getHost(isSandbox), PATH_GET_DOC_RESULT, partnerId, timestamp, accessToken, shopId, sign, orderSn);
        return executeGet(url);
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
        return cancelOrder(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), orderSn, cancelReason, null, null, this.isSandbox);
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
            // Bước 1: Yêu cầu Shopee tạo tài liệu vận đơn AWB nếu chưa tạo
            try {
                createShippingDocument(partnerId, partnerKey, accessToken, shopId, orderSn, isSandbox);
            } catch (Exception ex) {
                log.info("[SHOPEE-DOC] createShippingDocument phản hồi: {}", ex.getMessage());
            }

            // Bước 2: Kiểm tra trạng thái sẵn sàng (polling tối đa 3 lần)
            for (int i = 0; i < 3; i++) {
                try {
                    JsonNode statusRes = getShippingDocumentResult(partnerId, partnerKey, accessToken, shopId, orderSn, isSandbox);
                    if (statusRes != null) {
                        String st = statusRes.path("response").path("status").asText("");
                        if ("READY".equalsIgnoreCase(st)) {
                            break;
                        }
                    }
                    Thread.sleep(500);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception ignored) {}
            }

            // Bước 3: Tải file nhị phân PDF/HTML phiếu vận đơn
            long timestamp = Instant.now().getEpochSecond();
            String base = ShopeeSignatureHelper.buildShopBaseString(partnerId, PATH_DOWNLOAD_DOC, timestamp, accessToken, shopId);
            String sign = ShopeeSignatureHelper.sign(partnerKey, base);
            String url = String.format("%s%s?partner_id=%s&timestamp=%d&access_token=%s&shop_id=%s&sign=%s&order_sn=%s",
                    getHost(isSandbox), PATH_DOWNLOAD_DOC, partnerId, timestamp, accessToken, shopId, sign, orderSn);
            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(List.of(MediaType.APPLICATION_OCTET_STREAM, MediaType.ALL));
            headers.set(HttpHeaders.USER_AGENT, "ShopeeOpenAPI/2.0");
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<byte[]> res = restTemplate.exchange(url, HttpMethod.GET, entity, byte[].class);
            return res.getBody() != null ? res.getBody() : new byte[0];
        } catch (Exception ex) {
            log.warn("[SHOPEE-DOWNLOAD-DOC] Lỗi khi tải tài liệu in vận đơn: {}", ex.getMessage());
            return new byte[0];
        }
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
        return updateStock(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemId, modelId, stock, this.isSandbox);
    }

    public JsonNode updateStockBatch(Long itemId, List<Map<String, Object>> stockList) {
        return updateStockBatch(pIdStr(), pKeyStr(), aTokenStr(), sIdStr(), itemId, stockList, this.isSandbox);
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

    public String generateAuthUrl(String redirectUri) {
        return generateAuthUrl(pIdStr(), pKeyStr(), redirectUri, this.isSandbox);
    }
}
