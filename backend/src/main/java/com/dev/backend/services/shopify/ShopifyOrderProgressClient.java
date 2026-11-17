package com.dev.backend.services.shopify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/** Changes Shopify's fulfillment state; order tags are not proof of progress. */
@Slf4j
public class ShopifyOrderProgressClient {
    // ReportProgress supports merchant-managed orders from 2026-04.
    public static final String API_VERSION = "2026-04";
    private static final String QUERY = """
            query FcentricFulfillmentProgress($id: ID!, $after: String) {
              order(id: $id) {
                fulfillmentOrders(first: 100, after: $after) {
                  nodes { id status supportedActions { action } }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
            """;
    private static final String MUTATION = """
            mutation FcentricReportProgress($id: ID!, $progressReport: FulfillmentOrderReportProgressInput) {
              fulfillmentOrderReportProgress(id: $id, progressReport: $progressReport) {
                fulfillmentOrder { id status }
                userErrors { field message code }
              }
            }
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public ShopifyOrderProgressClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(java.net.HttpURLConnection connection, String method) throws java.io.IOException {
                super.prepareConnection(connection, method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(8000);
        factory.setReadTimeout(15000);
        restTemplate = new RestTemplate(factory);
        objectMapper = new ObjectMapper();
    }

    ShopifyOrderProgressClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public boolean reportProgress(String domain, String token, String orderId) {
        if (domain == null || !domain.matches("[a-z0-9][a-z0-9-]*\\.myshopify\\.com")
                || token == null || token.isBlank() || orderId == null) return false;
        String numericId = orderId.trim().replaceFirst("^gid://shopify/Order/", "");
        if (!numericId.matches("[1-9][0-9]*")) return false;

        String url = "https://" + domain + "/admin/api/" + API_VERSION + "/graphql.json";
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Shopify-Access-Token", token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            String cursor = null;
            boolean found = false;
            boolean allSucceeded = true;
            do {
                Map<String, Object> variables = new HashMap<>();
                variables.put("id", "gid://shopify/Order/" + numericId);
                variables.put("after", cursor);
                JsonNode order = execute(url, headers, QUERY, variables).path("order");
                JsonNode connection = order.path("fulfillmentOrders");
                if (!connection.path("nodes").isArray() || !connection.path("pageInfo").isObject()) return false;
                for (JsonNode fo : connection.path("nodes")) {
                    String status = fo.path("status").asText();
                    if ("CLOSED".equals(status) || "CANCELLED".equals(status)) continue;
                    found = true;
                    if ("IN_PROGRESS".equals(status)) continue;
                    if (!"OPEN".equals(status) || !canReportProgress(fo)) {
                        log.warn("[SHOPIFY-IN-PROGRESS] Fulfillment order {} cannot report progress (state: {})",
                                fo.path("id").asText(), status);
                        allSucceeded = false;
                        continue;
                    }
                    JsonNode result = execute(url, headers, MUTATION, Map.of(
                            "id", fo.path("id").asText(),
                            "progressReport", Map.of("reasonNotes", "FCentric: picking and packing at warehouse")
                    )).path("fulfillmentOrderReportProgress");
                    JsonNode errors = result.path("userErrors");
                    if (!errors.isArray() || !errors.isEmpty()
                            || !fo.path("id").asText().equals(result.path("fulfillmentOrder").path("id").asText())
                            || !"IN_PROGRESS".equals(result.path("fulfillmentOrder").path("status").asText())) {
                        log.warn("[SHOPIFY-IN-PROGRESS] Shopify did not confirm progress for {}: {}",
                                fo.path("id").asText(), errors);
                        allSucceeded = false;
                    }
                }
                JsonNode page = connection.path("pageInfo");
                if (!page.path("hasNextPage").asBoolean()) break;
                String next = page.path("endCursor").asText("");
                if (next.isBlank() || next.equals(cursor)) return false;
                cursor = next;
            } while (true);
            return found && allSucceeded;
        } catch (Exception e) {
            // Do not log HTTP bodies/headers: authorization failures can contain sensitive data.
            log.warn("[SHOPIFY-IN-PROGRESS] Could not update order {} ({})", numericId, e.getClass().getSimpleName());
            return false;
        }
    }

    private boolean canReportProgress(JsonNode fo) {
        for (JsonNode action : fo.path("supportedActions")) {
            if ("REPORT_PROGRESS".equals(action.path("action").asText())) return true;
        }
        return false;
    }

    private JsonNode execute(String url, HttpHeaders headers, String query, Map<String, Object> variables) throws Exception {
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST,
                new HttpEntity<>(Map.of("query", query, "variables", variables), headers), String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("Shopify returned no response");
        }
        JsonNode root = objectMapper.readTree(response.getBody());
        if (root == null || root.has("errors") || !root.path("data").isObject()) {
            log.warn("[SHOPIFY-IN-PROGRESS] GraphQL request rejected; check fulfillment permissions and API schema");
            throw new IllegalStateException("Shopify GraphQL response rejected");
        }
        return root.path("data");
    }
}
