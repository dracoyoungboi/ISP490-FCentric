package com.dev.backend.services.tiktok;

import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.constants.TikTokShopConstants;
import com.dev.backend.dto.response.customize.TikTokAuthorizedShopsResponse;
import com.dev.backend.dto.response.customize.TikTokShopDto;
import com.dev.backend.dto.response.customize.TikTokWarehouseDto;
import com.dev.backend.dto.response.customize.TikTokWarehousesResponse;
import com.dev.backend.dto.response.customize.TikTokProductDto;
import com.dev.backend.dto.response.customize.TikTokProductSearchResponse;
import com.dev.backend.dto.response.customize.TikTokSkuDto;
import com.dev.backend.dto.request.TikTokInventoryUpdateRequest;
import com.dev.backend.dto.request.TikTokOrderSearchRequest;
import com.dev.backend.dto.request.TikTokProductCreateRequest;
import com.dev.backend.dto.response.customize.TikTokInventoryUpdateResponse;
import com.dev.backend.dto.response.customize.TikTokOrderSearchResponse;
import com.dev.backend.dto.response.customize.TikTokProductCreateResponse;
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
import java.util.Locale;
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

    public TikTokShopClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
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
            throw new LoiThamSoException(ThongDiep.of("kenhBan.appKeyTrongKhiTaoUrlTikTok"));
        }
        String cleanAppKey = appKey.trim();
        String cleanState = (state != null && !state.isBlank()) ? state.trim() : java.util.UUID.randomUUID().toString();

        StringBuilder urlBuilder = new StringBuilder(TikTokShopConstants.AUTH_URL_PARTNER);
        urlBuilder.append("?service_id=").append(URLEncoder.encode(cleanAppKey, StandardCharsets.UTF_8));
        urlBuilder.append("&state=").append(URLEncoder.encode(cleanState, StandardCharsets.UTF_8));
        if (redirectUri != null && !redirectUri.isBlank()) {
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
            throw new LoiThamSoException(ThongDiep.of("kenhBan.appKeySecretTrongKhiDoiToken"));
        }
        if (authCode == null || authCode.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.authorizationCodeKhongDuocTrong"));
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
                    ThongDiep.of("kenhBan.khongTheDoiMaUyQuyenTikTok", e.getMessage()));
        }
    }

    /**
     * Làm mới Access Token bằng Refresh Token qua TikTok Shop Auth API.
     * Endpoint: GET https://auth.tiktok-shops.com/api/v2/token/refresh
     * Tham số: app_key, app_secret, refresh_token, grant_type=refresh_token
     */
    public JsonNode refreshToken(String appKey, String appSecret, String refreshToken) {
        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.appKeySecretTrongKhiLamMoiToken"));
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.refreshTokenTrong"));
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
                    ThongDiep.of("kenhBan.khongTheLamMoiAccessTokenTikTok", e.getMessage()));
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
            throw new LoiThamSoException(ThongDiep.of("kenhBan.accessTokenTrongKhiLayKhoTikTok"));
        }
        if (shopCipher == null || shopCipher.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.shopCipherTrongKhiLayKhoTikTok"));
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
                String id = w.hasNonNull("id") ? w.path("id").asText() : w.path("warehouse_id").asText(null);
                String name = w.hasNonNull("name") ? w.path("name").asText() : w.path("warehouse_name").asText(null);
                String type = w.hasNonNull("type") ? w.path("type").asText() : w.path("warehouse_type").asText(null);
                String subType = w.hasNonNull("sub_type") ? w.path("sub_type").asText() : w.path("warehouse_sub_type").asText(null);
                String effectStatus = w.hasNonNull("effect_status") ? w.path("effect_status").asText() : w.path("warehouse_effect_status").asText(null);
                boolean isDefault = w.hasNonNull("is_default") ? w.path("is_default").asBoolean(false) : false;

                dto.setId(id);
                dto.setName(name);
                dto.setWarehouseId(id);
                dto.setWarehouseName(name);
                dto.setType(type);
                dto.setWarehouseType(type);
                dto.setSubType(subType);
                dto.setWarehouseSubType(subType);
                dto.setEffectStatus(effectStatus);
                dto.setWarehouseEffectStatus(effectStatus);
                dto.setIsDefault(isDefault);
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
            throw new LoiThamSoException(ThongDiep.of("kenhBan.accessTokenTrongKhiTimSanPhamTikTok"));
        }
        if (shopCipher == null || shopCipher.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.shopCipherTrongKhiTimSanPhamTikTok"));
        }

        Map<String, String> queryParams = new HashMap<>();
        int validPageSize = Math.max(1, Math.min(pageSize, 100)); // TikTok tối đa 100 sản phẩm / trang
        queryParams.put("page_size", String.valueOf(validPageSize));
        if (pageToken != null && !pageToken.isBlank()) {
            queryParams.put("page_token", pageToken.trim());
        }

        String apiPath = TikTokShopConstants.PATH_PRODUCTS_SEARCH;
        // status: ALL để lấy toàn bộ danh mục sản phẩm của shop (ACTIVATE, DRAFT, PENDING, v.v.)
        String body = "{\"status\":\"ALL\"}";

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

    /**
     * Cập nhật tồn kho SKU theo sản phẩm cha trên TikTok Shop Open Platform (v202309).
     * Endpoint: POST /product/202309/products/{product_id}/inventory/update
     * Query: app_key, timestamp, shop_cipher, sign
     * Header: x-tts-access-token, Content-Type: application/json
     * Body: JSON TikTokInventoryUpdateRequest
     */
    public TikTokInventoryUpdateResponse updateProductInventory(String appKey, String appSecret, String accessToken,
                                                                String shopCipher, String productId,
                                                                TikTokInventoryUpdateRequest payload) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.accessTokenTrongKhiCapNhatTonTikTok"));
        }
        if (shopCipher == null || shopCipher.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.shopCipherTrongKhiCapNhatTonTikTok"));
        }
        if (productId == null || productId.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.productIdTrongKhiCapNhatTonTikTok"));
        }

        String apiPath = String.format(TikTokShopConstants.PATH_INVENTORY_UPDATE, productId.trim());
        String body;
        try {
            body = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.loiSerializeCapNhatTon", e.getMessage()), e);
        }

        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, Map.of(), body, appKey, appSecret, shopCipher);
        JsonNode root = executePost(fullSignedUrl, body, accessToken);

        TikTokInventoryUpdateResponse response = new TikTokInventoryUpdateResponse();
        response.setCode(root.path("code").asInt(0));
        response.setMessage(root.path("message").asText(""));
        response.setRequestId(root.path("request_id").asText(""));

        JsonNode dataNode = root.path("data");
        if (dataNode.isObject()) {
            TikTokInventoryUpdateResponse.InventoryUpdateData data = new TikTokInventoryUpdateResponse.InventoryUpdateData();
            JsonNode failedSkusNode = dataNode.path("failed_skus");
            if (failedSkusNode.isArray()) {
                java.util.List<TikTokInventoryUpdateResponse.FailedSku> failedList = new java.util.ArrayList<>();
                for (JsonNode f : failedSkusNode) {
                    TikTokInventoryUpdateResponse.FailedSku failed = new TikTokInventoryUpdateResponse.FailedSku();
                    failed.setId(f.path("id").asText(null));
                    failed.setCode(f.path("code").asInt(0));
                    failed.setMessage(f.path("message").asText(""));
                    failedList.add(failed);
                }
                data.setFailedSkus(failedList);
            }
            response.setData(data);
        }
        return response;
    }

    /**
     * Tạo mới sản phẩm từ FCentric lên TikTok Shop Open Platform (v202309).
     * Endpoint: POST /product/202309/products
     * Query: app_key, timestamp, shop_cipher, sign
     * Header: x-tts-access-token, Content-Type: application/json
     * Body: JSON TikTokProductCreateRequest
     */
    public TikTokProductCreateResponse createProduct(String appKey, String appSecret, String accessToken,
                                                     String shopCipher, TikTokProductCreateRequest payload) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.accessTokenTrongKhiCapNhatTonTikTok"));
        }
        if (shopCipher == null || shopCipher.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.shopCipherTrongKhiCapNhatTonTikTok"));
        }
        if (payload == null) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.tiktokPhanHoiRong"));
        }

        String apiPath = TikTokShopConstants.PATH_PRODUCTS_CREATE;
        String body;
        try {
            body = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.loiSerializeCapNhatTon", e.getMessage()), e);
        }

        Map<String, String> queryParams = Map.of("category_version", TikTokShopConstants.CATEGORY_VERSION_V2);
        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, queryParams, body, appKey, appSecret, shopCipher);
        JsonNode root = executePost(fullSignedUrl, body, accessToken);

        TikTokProductCreateResponse response = new TikTokProductCreateResponse();
        response.setCode(root.path("code").asInt(0));
        response.setMessage(root.path("message").asText(""));
        response.setRequestId(root.path("request_id").asText(""));

        JsonNode dataNode = root.path("data");
        if (dataNode.isObject()) {
            TikTokProductCreateResponse.ProductCreateData data = new TikTokProductCreateResponse.ProductCreateData();
            data.setProductId(dataNode.path("product_id").asText(null));

            JsonNode skusNode = dataNode.path("skus");
            if (skusNode.isArray()) {
                java.util.List<TikTokProductCreateResponse.CreatedSku> skuList = new java.util.ArrayList<>();
                for (JsonNode s : skusNode) {
                    TikTokProductCreateResponse.CreatedSku createdSku = new TikTokProductCreateResponse.CreatedSku();
                    createdSku.setId(s.path("id").asText(null));
                    createdSku.setSellerSku(s.path("seller_sku").asText(null));
                    skuList.add(createdSku);
                }
                data.setSkus(skuList);
            }
            response.setData(data);
        }
        return response;
    }

    /**
     * Sử dụng AI của TikTok Shop để gợi ý danh mục lá (Leaf Category) phiên bản V2 dựa trên tiêu đề và mô tả sản phẩm.
     * Endpoint: POST /product/202309/categories/recommend?category_version=v2
     */
    public String recommendCategoryV2(String appKey, String appSecret, String accessToken,
                                      String shopCipher, String productTitle, String description) {
        if (accessToken == null || accessToken.isBlank() || shopCipher == null || shopCipher.isBlank()) {
            return null;
        }
        if (productTitle == null || productTitle.isBlank()) {
            return null;
        }

        String apiPath = TikTokShopConstants.PATH_CATEGORIES_RECOMMEND;
        Map<String, Object> reqBody = new HashMap<>();
        reqBody.put("product_title", productTitle.trim());
        if (description != null && !description.isBlank()) {
            reqBody.put("description", description.trim());
        }
        reqBody.put("category_version", TikTokShopConstants.CATEGORY_VERSION_V2);

        String bodyJson;
        try {
            bodyJson = objectMapper.writeValueAsString(reqBody);
        } catch (Exception e) {
            log.warn("Lỗi serialize body recommend category TikTok: {}", e.getMessage());
            return null;
        }

        Map<String, String> queryParams = Map.of("category_version", TikTokShopConstants.CATEGORY_VERSION_V2);
        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, queryParams, bodyJson, appKey, appSecret, shopCipher);

        try {
            JsonNode root = executePost(fullSignedUrl, bodyJson, accessToken);
            JsonNode categoriesNode = root.path("data").path("categories");
            if (categoriesNode.isArray()) {
                for (JsonNode cat : categoriesNode) {
                    boolean isLeaf = cat.path("is_leaf").asBoolean(false);
                    String id = cat.path("id").asText(null);
                    JsonNode perms = cat.path("permission_statuses");
                    boolean available = true;
                    if (perms.isArray() && perms.size() > 0) {
                        available = false;
                        for (JsonNode p : perms) {
                            if ("AVAILABLE".equalsIgnoreCase(p.asText())) {
                                available = true;
                                break;
                            }
                        }
                    }
                    if (isLeaf && id != null && !id.isBlank() && available) {
                        log.info("TikTok Shop gợi ý danh mục V2 leaf thành công: id={}, name={}",
                                id, cat.path("local_display_name").asText(cat.path("name").asText("")));
                        return id;
                    }
                }
                // Fallback: Nếu không đánh dấu is_leaf nhưng có danh mục gợi ý
                for (JsonNode cat : categoriesNode) {
                    String id = cat.path("id").asText(null);
                    if (id != null && !id.isBlank()) {
                        return id;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Không thể lấy danh mục gợi ý V2 từ TikTok Shop (title: {}): {}", productTitle, e.getMessage());
        }
        return null;
    }

    /**
     * Lấy danh mục sản phẩm V2 từ TikTok Shop Open Platform (v202309).
     * Endpoint: GET /product/202309/categories?category_version=v2&category_id=...&locale=vi-VN
     */
    public JsonNode getCategoriesV2(String appKey, String appSecret, String accessToken,
                                    String shopCipher, String parentCategoryId, String locale) {
        if (accessToken == null || accessToken.isBlank() || shopCipher == null || shopCipher.isBlank()) {
            return null;
        }
        Map<String, String> queryParams = new HashMap<>();
        queryParams.put("category_version", TikTokShopConstants.CATEGORY_VERSION_V2);
        queryParams.put("locale", (locale != null && !locale.isBlank()) ? locale : "vi-VN");
        if (parentCategoryId != null && !parentCategoryId.isBlank()) {
            queryParams.put("category_id", parentCategoryId.trim());
        }

        String apiPath = TikTokShopConstants.PATH_CATEGORIES;
        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, queryParams, null, appKey, appSecret, shopCipher);

        try {
            return executeGet(fullSignedUrl, accessToken);
        } catch (Exception e) {
            log.warn("Lỗi khi tải danh mục V2 từ TikTok Shop (parentId: {}): {}", parentCategoryId, e.getMessage());
            return null;
        }
    }

    /**
     * Tìm kiếm danh mục lá V2 theo từ khóa (danh mục FCentric hoặc loại quần áo).
     * Duyệt qua các danh mục gốc và nhánh con để tìm danh mục leaf phù hợp nhất.
     */
    public String timDanhMucLaTheoTuKhoaV2(String appKey, String appSecret, String accessToken,
                                          String shopCipher, String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String kwLower = keyword.toLowerCase(Locale.ROOT).trim();
        try {
            JsonNode rootRes = getCategoriesV2(appKey, appSecret, accessToken, shopCipher, null, "vi-VN");
            if (rootRes == null) return null;

            JsonNode cats = rootRes.path("data").path("categories");
            if (!cats.isArray()) return null;

            String fashionParentId = null;
            for (JsonNode c : cats) {
                String name = c.path("local_display_name").asText(c.path("name").asText("")).toLowerCase(Locale.ROOT);
                if (name.contains("thời trang") || name.contains("quần áo") || name.contains("fashion") || name.contains("apparel")) {
                    fashionParentId = c.path("id").asText(null);
                    break;
                }
            }

            if (fashionParentId != null) {
                String leafId = timLeafCategoryRecursive(appKey, appSecret, accessToken, shopCipher, fashionParentId, kwLower, 0);
                if (leafId != null) {
                    return leafId;
                }
            }
        } catch (Exception e) {
            log.warn("Lỗi tìm kiếm danh mục lá TikTok V2 theo từ khóa '{}': {}", keyword, e.getMessage());
        }
        return null;
    }

    private String timLeafCategoryRecursive(String appKey, String appSecret, String accessToken,
                                            String shopCipher, String parentId, String keyword, int depth) {
        if (depth > 5) return null;
        JsonNode res = getCategoriesV2(appKey, appSecret, accessToken, shopCipher, parentId, "vi-VN");
        if (res == null) return null;
        JsonNode cats = res.path("data").path("categories");
        if (!cats.isArray() || cats.isEmpty()) return null;

        String fallbackLeaf = null;
        String bestSubParent = null;

        for (JsonNode c : cats) {
            boolean isLeaf = c.path("is_leaf").asBoolean(false);
            String id = c.path("id").asText(null);
            String name = c.path("local_display_name").asText(c.path("name").asText("")).toLowerCase(Locale.ROOT);

            if (isLeaf && id != null) {
                if (fallbackLeaf == null) {
                    fallbackLeaf = id;
                }
                if (name.contains(keyword) || keyword.contains(name)) {
                    return id;
                }
            } else if (!isLeaf && id != null) {
                if (name.contains(keyword) || (keyword.contains("áo") && (name.contains("áo") || name.contains("top")))
                        || (keyword.contains("quần") && (name.contains("quần") || name.contains("bottom")))) {
                    bestSubParent = id;
                }
            }
        }

        if (bestSubParent != null) {
            String subLeaf = timLeafCategoryRecursive(appKey, appSecret, accessToken, shopCipher, bestSubParent, keyword, depth + 1);
            if (subLeaf != null) return subLeaf;
        }

        return fallbackLeaf;
    }

    /**
     * Tải tệp ảnh nhị phân lên CDN của TikTok Shop Open Platform (v202309).
     * Endpoint: POST /product/202309/images/upload
     * Query: app_key, timestamp, sign (TUYỆT ĐỐI KHÔNG truyền shop_cipher để tránh lỗi HTTP 400 mã 36009004)
     * Header: x-tts-access-token, Content-Type: multipart/form-data
     * Multipart: data (file binary), use_case ("MAIN_IMAGE" bắt buộc)
     * Trả về URI nội bộ dạng `tos-maliva-i-o260ufnz6q-us/...` để gắn vào main_images khi tạo sản phẩm.
     */
    public String uploadImage(String appKey, String appSecret, String accessToken,
                              String shopCipher, byte[] imageBytes, String fileName) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.accessTokenTrongKhiCapNhatTonTikTok"));
        }
        if (imageBytes == null || imageBytes.length == 0) {
            return null;
        }

        String apiPath = TikTokShopConstants.PATH_IMAGE_UPLOAD;
        // Theo quy chuẩn TikTok Shop API v202309, /product/202309/images/upload là API cấp Platform,
        // không nhận tham số query shop_cipher (truyền shop_cipher sẽ bị lỗi HTTP 400 mã 36009004).
        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, Map.of(), "", appKey, appSecret, null);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set(TikTokShopConstants.HEADER_ACCESS_TOKEN, accessToken);

        org.springframework.core.io.ByteArrayResource resource = new org.springframework.core.io.ByteArrayResource(imageBytes) {
            @Override
            public String getFilename() {
                return (fileName != null && !fileName.isBlank()) ? fileName : "product_image.jpg";
            }
        };

        org.springframework.util.MultiValueMap<String, Object> form = new org.springframework.util.LinkedMultiValueMap<>();
        form.add("data", resource);
        // use_case là tham số bắt buộc trong body multipart của TikTok Shop API v202309
        form.add("use_case", "MAIN_IMAGE");

        HttpEntity<org.springframework.util.MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(form, headers);

        try {
            ResponseEntity<String> res = restTemplate.exchange(fullSignedUrl, HttpMethod.POST, requestEntity, String.class);
            JsonNode root = parseAndValidateResponse(res.getBody());
            String uri = root.path("data").path("uri").asText(null);
            if (uri != null && !uri.isBlank()) {
                log.info("Tải ảnh lên TikTok Shop CDN thành công: uri={}", uri);
            }
            return uri;
        } catch (HttpStatusCodeException e) {
            handleHttpException("POST", fullSignedUrl, e);
            throw e;
        } catch (LoiCoMaException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi khi tải ảnh lên TikTok Shop CDN: {}", e.getMessage());
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_API_ERROR,
                    ThongDiep.of("kenhBan.tiktokLoiUploadAnh", e.getMessage()));
        }
    }

    /**
     * Tìm kiếm danh sách đơn hàng từ TikTok Shop API v202309 theo cửa sổ thời gian hoặc trạng thái.
     * Endpoint: POST /order/202309/orders/search
     * Query params: app_key, timestamp, sign, shop_cipher
     * Body: JSON TikTokOrderSearchRequest
     */
    public TikTokOrderSearchResponse searchOrders(String appKey, String appSecret, String accessToken,
                                                 String shopCipher, TikTokOrderSearchRequest request) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.accessTokenTrongKhiTimDonTikTok"));
        }
        if (shopCipher == null || shopCipher.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.shopCipherTrongKhiTimDonTikTok"));
        }

        String apiPath = TikTokShopConstants.PATH_ORDERS_SEARCH;
        String body;
        try {
            body = objectMapper.writeValueAsString(request != null ? request : new TikTokOrderSearchRequest());
        } catch (Exception e) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.loiSerializeTimDon", e.getMessage()), e);
        }

        Map<String, String> queryParams = new HashMap<>();
        int pageSize = (request != null && request.getPageSize() != null)
                ? Math.max(1, Math.min(request.getPageSize(), 100))
                : 50;
        queryParams.put("page_size", String.valueOf(pageSize));
        if (request != null && request.getPageToken() != null && !request.getPageToken().isBlank()) {
            queryParams.put("page_token", request.getPageToken().trim());
        }

        String fullSignedUrl = buildUrlWithSign(TikTokShopConstants.BASE_URL, apiPath, queryParams, body, appKey, appSecret, shopCipher);
        JsonNode root = executePost(fullSignedUrl, body, accessToken);

        try {
            return objectMapper.treeToValue(root, TikTokOrderSearchResponse.class);
        } catch (Exception e) {
            log.error("Lỗi parse phản hồi danh sách đơn hàng TikTok Shop: {}", e.getMessage());
            throw new LoiCoMaException(HttpStatus.INTERNAL_SERVER_ERROR, MaLoi.TIKTOK_API_ERROR,
                    ThongDiep.of("kenhBan.khongThePhanTichDonTikTok", e.getMessage()));
        }
    }

    public TikTokAuthorizedShopsResponse getAuthorizedShops(String appKey, String appSecret, String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.accessTokenTrongKhiLayGianHangTikTok"));
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
            throw new LoiThamSoException(ThongDiep.of("kenhBan.appKeyTrongKhiGoiTikTokApi"));
        }
        if (appSecret == null || appSecret.isBlank()) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.appSecretTrongKhiTinhChuKyTikTok"));
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
                    ThongDiep.of("kenhBan.khongTheKetNoiTikTokApi", e.getMessage()));
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
                    ThongDiep.of("kenhBan.khongTheGuiDuLieuTikTokApi", e.getMessage()));
        }
    }

    /**
     * Parse JSON phản hồi từ TikTok Shop và kiểm tra mã nghiệp vụ `code`.
     * Theo đặc tả v202309: `code == 0` là thành công, khác 0 là lỗi.
     */
    public JsonNode parseAndValidateResponse(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_API_ERROR,
                    ThongDiep.of("kenhBan.tiktokPhanHoiRong"));
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            if (root.has("code") && root.get("code").asInt() != 0) {
                int code = root.get("code").asInt();
                String message = root.path("message").asText(null);
                log.warn("TikTok Shop API trả về mã lỗi nghiệp vụ: code={}, message={}", code, message);
                throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TIKTOK_API_ERROR, message != null
                        ? ThongDiep.of("kenhBan.loiTuTikTok", code, message)
                        : ThongDiep.of("kenhBan.loiTuTikTokMacDinh", code));
            }
            return root;
        } catch (LoiCoMaException e) {
            throw e;
        } catch (Exception e) {
            log.error("Không thể phân giải JSON từ TikTok Shop: {}, nội dung: {}", e.getMessage(), responseBody);
            throw new LoiCoMaException(HttpStatus.BAD_GATEWAY, MaLoi.TIKTOK_API_ERROR,
                    ThongDiep.of("kenhBan.dinhDangPhanHoiTikTokKhongHopLe", e.getMessage()));
        }
    }

    /**
     * Xử lý ngoại lệ HTTP status code, đặc biệt nhận diện HTTP 429 Rate Limit để tránh cháy request.
     */
    private void handleHttpException(String method, String url, HttpStatusCodeException e) {
        log.error("TikTok Shop API {} HTTP Error: url={}, status={}, body={}", method, url, e.getStatusCode(), e.getResponseBodyAsString());
        if (e.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
            throw new LoiCoMaException(HttpStatus.TOO_MANY_REQUESTS, MaLoi.TIKTOK_RATE_LIMIT,
                    ThongDiep.of("kenhBan.tiktokVuotGioiHanTanSuat"));
        }
        try {
            JsonNode errorNode = objectMapper.readTree(e.getResponseBodyAsString());
            String message = errorNode.path("message").asText(e.getStatusText());
            int code = errorNode.path("code").asInt(e.getStatusCode().value());
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TIKTOK_API_ERROR,
                    ThongDiep.of("kenhBan.loiTuTikTok", code, message));
        } catch (LoiCoMaException ex) {
            throw ex;
        } catch (Exception parseEx) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TIKTOK_API_ERROR,
                    ThongDiep.of("kenhBan.loiGoiTikTokApiHttp", e.getStatusCode().value(), e.getStatusText()));
        }
    }
}
