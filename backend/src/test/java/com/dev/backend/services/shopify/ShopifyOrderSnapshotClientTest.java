package com.dev.backend.services.shopify;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ShopifyOrderSnapshotClientTest {
    @Test void progressNotificationResolvesOrderAndReadsItsCurrentCanonicalState() throws Exception {
        RestTemplate rest = new RestTemplate();
        var server = MockRestServiceServer.bindTo(rest).build();
        String base = "https://test.myshopify.com/admin/api/2026-04/";
        server.expect(requestTo(base + "graphql.json"))
                .andExpect(jsonPath("$.variables.id").value("gid://shopify/FulfillmentOrder/55"))
                .andRespond(withSuccess("{\"data\":{\"fulfillmentOrder\":{\"order\":{\"id\":\"gid://shopify/Order/123\"}}}}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(base + "orders/123.json"))
                .andRespond(withSuccess("{\"order\":{\"id\":123,\"financial_status\":\"paid\",\"cancelled_at\":null}}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(base + "graphql.json"))
                .andRespond(withSuccess("{\"data\":{\"order\":{\"id\":\"gid://shopify/Order/123\",\"displayFulfillmentStatus\":\"IN_PROGRESS\"}}}", MediaType.APPLICATION_JSON));
        var result = new ShopifyOrderSnapshotClient(rest, new ObjectMapper()).fetch("test.myshopify.com", "test-key", "FulfillmentOrder", "55");
        assertEquals("123", result.order().path("id").asText());
        assertTrue(result.inProgress());
        server.verify();
    }
    @Test void graphqlAccessDenialCannotBeAcknowledgedAsAnUpdatedOrder() {
        RestTemplate rest = new RestTemplate();
        var server = MockRestServiceServer.bindTo(rest).build();
        String base = "https://test.myshopify.com/admin/api/2026-04/";
        server.expect(requestTo(base + "orders/123.json")).andRespond(withSuccess("{\"order\":{\"id\":123}}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(base + "graphql.json")).andRespond(withSuccess("{\"errors\":[{\"message\":\"ACCESS_DENIED\"}]}", MediaType.APPLICATION_JSON));
        assertThrows(IllegalStateException.class, () -> new ShopifyOrderSnapshotClient(rest, new ObjectMapper()).fetch("test.myshopify.com", "test-key", "Order", "123"));
        server.verify();
    }
}
