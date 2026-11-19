package com.dev.backend.services.shopify;

import com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta.FulfillmentOrderSnapshot;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Client GraphQL (API 2026-04) & REST hỗ trợ nghiệp vụ đa kho Shopify:
 * - Batch đọc FulfillmentOrder (assignedLocation, deliveryMethod, lineItems) + returnStatus trong 1 lượt.
 * - Điều phối chuyển Location (fulfillmentOrderMove) khi Kho Tổng chọn kho xuất khác sàn.
 * - Xác nhận sẵn sàng nhận tại cửa hàng (fulfillmentOrderLineItemsPreparedForPickup) cho đơn PICK_UP.
 * - Tự động kết nối SKU vào Location mới (inventory_levels/connect.json).
 */
@Slf4j
@Component
public class ShopifyMultiLocationClient {

    public static final String GRAPHQL_API_VERSION = "2026-04";
    public static final String REST_API_VERSION = "2024-01";

    private static final String BATCH_ORDER_QUERY = """
            query FcentricBatchOrderMeta($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on Order {
                  id
                  returnStatus
                  fulfillmentOrders(first: 10) {
                    nodes {
                      id
                      status
                      deliveryMethod { methodType }
                      assignedLocation { location { id name } }
                      lineItems(first: 50) {
                        nodes { sku remainingQuantity }
                      }
                    }
                  }
                }
              }
            }
            """;

    private static final String SINGLE_ORDER_FO_QUERY = """
            query FcentricOrderFulfillmentOrders($id: ID!) {
              order(id: $id) {
                id
                fulfillmentOrders(first: 20) {
                  nodes {
                    id
                    status
                    deliveryMethod { methodType }
                    supportedActions { action }
                    assignedLocation { location { id name } }
                  }
                }
              }
            }
            """;

    private static final String MOVE_FO_MUTATION = """
            mutation FcentricFulfillmentOrderMove($id: ID!, $newLocationId: ID!) {
              fulfillmentOrderMove(id: $id, newLocationId: $newLocationId) {
                movedFulfillmentOrder {
                  id
                  status
                  assignedLocation { location { id name } }
                }
                userErrors { field message }
              }
            }
            """;

    private static final String PREPARE_PICKUP_MUTATION = """
            mutation FcentricPreparePickup($input: FulfillmentOrderLineItemsPreparedForPickupInput!) {
              fulfillmentOrderLineItemsPreparedForPickup(input: $input) {
                userErrors { field message }
              }
            }
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public ShopifyMultiLocationClient(ObjectMapper objectMapper) {
        this(createDefaultRestTemplate(), objectMapper);
    }

    ShopifyMultiLocationClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    private static RestTemplate createDefaultRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(java.net.HttpURLConnection connection, String method) throws java.io.IOException {
                super.prepareConnection(connection, method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(12000);
        return new RestTemplate(factory);
    }

    public record OrderGraphMeta(String returnStatus, List<FulfillmentOrderSnapshot> fulfillmentOrders) {}

    /** Đọc returnStatus và fulfillmentOrders cho tối đa 50 đơn hàng Shopify trong 1 lần gọi GraphQL. */
    public Map<String, OrderGraphMeta> fetchOrderBatchMeta(String domain, String token, List<String> numericOrderIds) {
        if (!isValidCredentials(domain, token) || numericOrderIds == null || numericOrderIds.isEmpty()) {
            return Collections.emptyMap();
        }
        List<String> gids = new ArrayList<>();
        for (String id : numericOrderIds) {
            String num = toNumericId(id);
            if (num != null) {
                gids.add("gid://shopify/Order/" + num);
            }
        }
        if (gids.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, OrderGraphMeta> result = new LinkedHashMap<>();
        try {
            String url = graphqlUrl(domain);
            HttpHeaders headers = createHeaders(token);
            for (int start = 0; start < gids.size(); start += 50) {
                List<String> chunk = gids.subList(start, Math.min(start + 50, gids.size()));
                JsonNode data = executeGraphQl(url, headers, BATCH_ORDER_QUERY, Map.of("ids", chunk));
                JsonNode nodes = data.path("nodes");
                if (!nodes.isArray()) continue;
                for (JsonNode node : nodes) {
                    String numOrderId = toNumericId(node.path("id").asText(""));
                    if (numOrderId == null) continue;
                    String returnStatus = node.path("returnStatus").asText("").trim();
                    List<FulfillmentOrderSnapshot> fos = parseFulfillmentOrders(node.path("fulfillmentOrders").path("nodes"));
                    result.put(numOrderId, new OrderGraphMeta(returnStatus, fos));
                }
            }
        } catch (Exception ex) {
            log.debug("[SHOPIFY-MULTI-CLIENT] Không đọc được batch GraphQL fulfillmentOrders: {}", ex.getMessage());
        }
        return result;
    }

    /** Chuyển các FulfillmentOrder đang OPEN/SCHEDULED sang Location ứng với kho mà Kho Tổng đã điều tiết. */
    public boolean moveOpenFulfillmentOrdersToLocation(String domain, String token, String orderId, String targetLocationId) {
        String numOrderId = toNumericId(orderId);
        String numLocId = toNumericId(targetLocationId);
        if (!isValidCredentials(domain, token) || numOrderId == null || numLocId == null) {
            return false;
        }
        try {
            String url = graphqlUrl(domain);
            HttpHeaders headers = createHeaders(token);
            JsonNode orderNode = executeGraphQl(url, headers, SINGLE_ORDER_FO_QUERY,
                    Map.of("id", "gid://shopify/Order/" + numOrderId)).path("order");
            JsonNode foNodes = orderNode.path("fulfillmentOrders").path("nodes");
            if (!foNodes.isArray() || foNodes.isEmpty()) {
                return false;
            }
            String targetLocGid = "gid://shopify/Location/" + numLocId;
            boolean movedAny = false;
            for (JsonNode fo : foNodes) {
                String foId = fo.path("id").asText("").trim();
                String status = fo.path("status").asText("").trim().toUpperCase();
                String currentLocNum = toNumericId(fo.path("assignedLocation").path("location").path("id").asText(""));
                if (foId.isBlank() || numLocId.equals(currentLocNum)) continue;
                if (!("OPEN".equals(status) || "SCHEDULED".equals(status) || "ON_HOLD".equals(status))) continue;
                if (!supportsAction(fo, "MOVE") && !"OPEN".equals(status) && !"SCHEDULED".equals(status)) continue;

                JsonNode moveRes = executeGraphQl(url, headers, MOVE_FO_MUTATION, Map.of(
                        "id", foId,
                        "newLocationId", targetLocGid
                )).path("fulfillmentOrderMove");
                JsonNode errs = moveRes.path("userErrors");
                if (errs.isArray() && !errs.isEmpty()) {
                    log.warn("[SHOPIFY-MOVE] Không chuyển được FO {} sang Location {}: {}", foId, numLocId, errs);
                } else {
                    movedAny = true;
                    log.info("[SHOPIFY-MOVE] Đã chuyển FO {} của đơn {} sang Location {}", foId, numOrderId, numLocId);
                }
            }
            return movedAny;
        } catch (Exception ex) {
            log.warn("[SHOPIFY-MOVE] Lỗi chuyển kho trên Shopify cho đơn {} -> {}: {}", numOrderId, numLocId, ex.getMessage());
            return false;
        }
    }

    /** Báo khách hàng sẵn sàng nhận tại cửa hàng đối với đơn Shopify Local Pickup (PICK_UP) sau khi đóng gói xong. */
    public boolean prepareForPickupIfApplicable(String domain, String token, String orderId) {
        String numOrderId = toNumericId(orderId);
        if (!isValidCredentials(domain, token) || numOrderId == null) {
            return false;
        }
        try {
            String url = graphqlUrl(domain);
            HttpHeaders headers = createHeaders(token);
            JsonNode foNodes = executeGraphQl(url, headers, SINGLE_ORDER_FO_QUERY,
                    Map.of("id", "gid://shopify/Order/" + numOrderId)).path("order").path("fulfillmentOrders").path("nodes");
            if (!foNodes.isArray() || foNodes.isEmpty()) return false;

            List<Map<String, Object>> lineItemsByFo = new ArrayList<>();
            for (JsonNode fo : foNodes) {
                String method = fo.path("deliveryMethod").path("methodType").asText("").trim().toUpperCase();
                if (!"PICK_UP".equals(method) && !"PICKUP".equals(method)) continue;
                String status = fo.path("status").asText("").trim().toUpperCase();
                if ("CLOSED".equals(status) || "CANCELLED".equals(status)) continue;
                String foId = fo.path("id").asText("").trim();
                if (!foId.isBlank()) {
                    lineItemsByFo.add(Map.of("fulfillmentOrderId", foId));
                }
            }
            if (lineItemsByFo.isEmpty()) return false;

            JsonNode res = executeGraphQl(url, headers, PREPARE_PICKUP_MUTATION,
                    Map.of("input", Map.of("lineItemsByFulfillmentOrder", lineItemsByFo)))
                    .path("fulfillmentOrderLineItemsPreparedForPickup");
            JsonNode errs = res.path("userErrors");
            if (errs.isArray() && !errs.isEmpty()) {
                log.warn("[SHOPIFY-PICKUP] Shopify từ chối preparedForPickup đơn {}: {}", numOrderId, errs);
                return false;
            }
            log.info("[SHOPIFY-PICKUP] Đã xác nhận sẵn sàng nhận tại cửa hàng cho đơn {}", numOrderId);
            return true;
        } catch (Exception ex) {
            log.warn("[SHOPIFY-PICKUP] Không gọi được preparedForPickup cho đơn {}: {}", numOrderId, ex.getMessage());
            return false;
        }
    }

    /** Kết nối inventory_item_id vào location_id mới trước khi ghi tồn kho. */
    public boolean connectInventoryLevel(String domain, String token, Long locationId, Long inventoryItemId) {
        if (!isValidCredentials(domain, token) || locationId == null || locationId <= 0
                || inventoryItemId == null || inventoryItemId <= 0) {
            return false;
        }
        try {
            String url = "https://" + domain + "/admin/api/" + REST_API_VERSION + "/inventory_levels/connect.json";
            Map<String, Object> body = Map.of(
                    "location_id", locationId,
                    "inventory_item_id", inventoryItemId
            );
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), createHeaders(token));
            ResponseEntity<String> res = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            boolean ok = res.getStatusCode().is2xxSuccessful();
            if (ok) {
                log.info("[SHOPIFY-CONNECT] Đã kết nối inventory_item {} vào Location {}", inventoryItemId, locationId);
            }
            return ok;
        } catch (Exception ex) {
            log.warn("[SHOPIFY-CONNECT] Không kết nối được item {} vào Location {}: {}", inventoryItemId, locationId, ex.getMessage());
            return false;
        }
    }

    /** Chuẩn hóa danh sách FulfillmentOrderSnapshot từ GraphQL nodes. */
    public static List<FulfillmentOrderSnapshot> parseFulfillmentOrders(JsonNode foNodes) {
        if (foNodes == null || !foNodes.isArray() || foNodes.isEmpty()) {
            return List.of();
        }
        List<FulfillmentOrderSnapshot> list = new ArrayList<>();
        for (JsonNode fo : foNodes) {
            String id = toNumericId(fo.path("id").asText(""));
            String locId = toNumericId(fo.path("assignedLocation").path("location").path("id").asText(""));
            String locName = fo.path("assignedLocation").path("location").path("name").asText("").trim();
            String methodType = fo.path("deliveryMethod").path("methodType").asText("").trim();
            String status = fo.path("status").asText("").trim();
            List<String> skus = new ArrayList<>();
            JsonNode items = fo.path("lineItems").path("nodes");
            if (items.isArray()) {
                for (JsonNode it : items) {
                    int rem = it.path("remainingQuantity").asInt(1);
                    String sku = it.path("sku").asText("").trim();
                    if (rem > 0 && !sku.isBlank()) skus.add(sku);
                }
            }
            list.add(FulfillmentOrderSnapshot.builder()
                    .id(id != null ? id : fo.path("id").asText(""))
                    .status(status)
                    .assignedLocationId(locId)
                    .assignedLocationName(locName)
                    .deliveryMethodType(methodType)
                    .skus(skus)
                    .build());
        }
        return list;
    }

    public static String toNumericId(String raw) {
        if (raw == null) return null;
        String clean = raw.trim();
        if (clean.isEmpty()) return null;
        if (clean.contains("/")) {
            clean = clean.substring(clean.lastIndexOf('/') + 1).trim();
        }
        return clean.matches("[1-9][0-9]*") ? clean : null;
    }

    private static boolean supportsAction(JsonNode fo, String actionName) {
        for (JsonNode action : fo.path("supportedActions")) {
            if (actionName.equalsIgnoreCase(action.path("action").asText(""))) return true;
        }
        return false;
    }

    private static boolean isValidCredentials(String domain, String token) {
        return domain != null && domain.matches("[a-z0-9][a-z0-9-]*\\.myshopify\\.com")
                && token != null && !token.isBlank();
    }

    private static String graphqlUrl(String domain) {
        return "https://" + domain + "/admin/api/" + GRAPHQL_API_VERSION + "/graphql.json";
    }

    private static HttpHeaders createHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Shopify-Access-Token", token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        return headers;
    }

    private JsonNode executeGraphQl(String url, HttpHeaders headers, String query, Map<String, Object> variables) throws Exception {
        ResponseEntity<String> res = restTemplate.exchange(url, HttpMethod.POST,
                new HttpEntity<>(Map.of("query", query, "variables", variables), headers), String.class);
        if (!res.getStatusCode().is2xxSuccessful() || res.getBody() == null) {
            throw new IllegalStateException("Shopify GraphQL returned empty response");
        }
        JsonNode root = objectMapper.readTree(res.getBody());
        if (root == null || root.has("errors") || !root.path("data").isObject()) {
            throw new IllegalStateException("Shopify GraphQL rejected request");
        }
        return root.path("data");
    }
}
