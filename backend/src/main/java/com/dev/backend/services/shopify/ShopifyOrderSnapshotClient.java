package com.dev.backend.services.shopify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component
public class ShopifyOrderSnapshotClient {
    private final RestTemplate rest;
    private final ObjectMapper mapper;
    @Autowired
    public ShopifyOrderSnapshotClient(ObjectMapper mapper) {
        this(com.dev.backend.services.omnichannel.OmnichannelTelemetryInterceptor.attach(new RestTemplate(factory())), mapper);
    }
    ShopifyOrderSnapshotClient(RestTemplate rest, ObjectMapper mapper) { this.rest = rest; this.mapper = mapper; }

    static SimpleClientHttpRequestFactory factory() {
        var factory = new SimpleClientHttpRequestFactory() {
            @Override protected void prepareConnection(java.net.HttpURLConnection connection, String method) throws java.io.IOException {
                super.prepareConnection(connection, method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(10000);
        return factory;
    }

    public record Snapshot(JsonNode order, boolean inProgress) {}

    public Snapshot fetch(String domain, String token, String referenceType, String referenceId) throws Exception {
        if (!domain.matches("[a-z0-9][a-z0-9-]*\\.myshopify\\.com") || !referenceId.matches("[1-9][0-9]*")) {
            throw new IllegalArgumentException("Invalid Shopify reference");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Shopify-Access-Token", token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        String base = "https://" + domain + "/admin/api/2026-04/";
        String orderId = referenceId;
        if (!"Order".equals(referenceType)) {
            String field = switch (referenceType) { case "FulfillmentOrder" -> "fulfillmentOrder"; case "Return" -> "return"; default -> throw new IllegalArgumentException("Invalid reference type"); };
            JsonNode data = graphql(base, headers, "query($id:ID!){" + field + "(id:$id){order{id}}}",
                    Map.of("id", "gid://shopify/" + referenceType + "/" + referenceId));
            orderId = data.path(field).path("order").path("id").asText("").replaceFirst("^gid://shopify/Order/", "");
            if (!orderId.matches("[1-9][0-9]*")) throw new IllegalStateException("Shopify order reference unavailable");
        }
        ResponseEntity<String> response = rest.exchange(base + "orders/" + orderId + ".json", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        if (response.getBody() == null) throw new IllegalStateException("Missing Shopify order");
        JsonNode order = mapper.readTree(response.getBody()).path("order");
        if (!order.isObject() || !orderId.equals(order.path("id").asText())) throw new IllegalStateException("Unexpected Shopify order");
        JsonNode progress = graphql(base, headers,
                "query($id:ID!){order(id:$id){id displayFulfillmentStatus returnStatus fulfillmentOrders(first:10){nodes{id status deliveryMethod{methodType} assignedLocation{location{id name}} lineItems(first:50){nodes{sku remainingQuantity}}}}}}",
                Map.of("id", "gid://shopify/Order/" + orderId));
        JsonNode progressOrder = progress.path("order");
        if (!("gid://shopify/Order/" + orderId).equals(progressOrder.path("id").asText())
                || progressOrder.path("displayFulfillmentStatus").asText("").isBlank()) {
            throw new IllegalStateException("Shopify order progress unavailable");
        }
        if (order instanceof com.fasterxml.jackson.databind.node.ObjectNode orderObj) {
            String returnStatus = progressOrder.path("returnStatus").asText("").trim();
            if (!returnStatus.isBlank() && !"NO_RETURN".equalsIgnoreCase(returnStatus)) {
                orderObj.put("return_status", returnStatus);
            }
            JsonNode foNodes = progressOrder.path("fulfillmentOrders").path("nodes");
            if (foNodes.isArray() && !foNodes.isEmpty()) {
                orderObj.set("fulfillment_orders_gql", mapper.valueToTree(ShopifyMultiLocationClient.parseFulfillmentOrders(foNodes)));
            }
        }
        return new Snapshot(order, "IN_PROGRESS".equals(progressOrder.path("displayFulfillmentStatus").asText()));
    }

    JsonNode graphql(String base, HttpHeaders headers, String query, Map<String, ?> variables) throws Exception {
        var response = rest.exchange(base + "graphql.json", HttpMethod.POST,
                new HttpEntity<>(Map.of("query", query, "variables", variables), headers), String.class);
        if (response.getBody() == null) throw new IllegalStateException("Missing GraphQL response");
        JsonNode root = mapper.readTree(response.getBody());
        if (root.has("errors") || !root.path("data").isObject()) throw new IllegalStateException("Shopify GraphQL rejected request");
        return root.path("data");
    }
}
