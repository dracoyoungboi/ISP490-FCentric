package com.dev.backend.services.shopify;

import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.services.KenhBanHangService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ShopifyRealtimeRegistrationTest {
    private static final String CALLBACK = "https://fcentric.net/api/v1/shopify/webhook";
    private final ShopifyRealtimeConnection connection = mock(ShopifyRealtimeConnection.class);
    private final KenhBanHangService credentials = mock(KenhBanHangService.class);
    private final ShopifyWebhookInbox inbox = mock(ShopifyWebhookInbox.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private ShopifyRealtimeRegistration registration;
    private MockRestServiceServer server;
    private final KenhBanHang channel = KenhBanHang.builder().id(2).build();
    @BeforeEach void setup() {
        RestTemplate rest = new RestTemplate();
        server = MockRestServiceServer.bindTo(rest).build();
        registration = new ShopifyRealtimeRegistration(connection, credentials, inbox, mapper, "https://fcentric.net/api/");
        ReflectionTestUtils.setField(registration, "rest", rest);
        when(connection.current()).thenReturn(channel);
        when(connection.domain(channel)).thenReturn("test.myshopify.com");
        when(connection.signingSecret(channel)).thenReturn("secret");
        when(credentials.getDecryptedShopifyAccessToken()).thenReturn("test-key");
    }
    private void probe() {
        server.expect(requestTo(CALLBACK)).andExpect(request -> assertFalse(request.getHeaders().containsKey("X-Shopify-Access-Token")))
                .andRespond(withSuccess("{\"service\":\"fcentric-shopify-realtime-v1\"}", MediaType.APPLICATION_JSON));
    }
    private void existing(String omitted) throws Exception {
        List<Map<String, String>> nodes = ShopifyWebhookService.TOPICS.stream().filter(topic -> !topic.equals(omitted))
                .map(topic -> Map.of("topic", topic.toUpperCase(java.util.Locale.ROOT).replace('/', '_'), "uri", CALLBACK)).toList();
        server.expect(requestTo("https://test.myshopify.com/admin/api/2026-04/graphql.json"))
                .andRespond(withSuccess(mapper.writeValueAsString(Map.of("data", Map.of("webhookSubscriptions", Map.of("nodes", nodes,
                        "pageInfo", Map.of("hasNextPage", false))))), MediaType.APPLICATION_JSON));
    }
    @Test void existingSubscriptionsAreNotCreatedAgain() throws Exception {
        probe(); existing("");
        var result = registration.register();
        assertEquals(true, result.get("ready"));
        assertEquals(ShopifyWebhookService.TOPICS.size(), result.get("activeTopics"));
        server.verify();
    }
    @Test void oldPublicDeploymentOrSpaFallbackMustNotBeRegistered() {
        server.expect(requestTo(CALLBACK)).andRespond(withSuccess("<html>SPA</html>", MediaType.TEXT_HTML));
        assertEquals(false, registration.register().get("ready"));
        server.verify();
    }
    @Test void missingSecretCannotEnableUnsignedDelivery() {
        when(connection.signingSecret(channel)).thenReturn(null);
        assertEquals(false, registration.register().get("ready"));
        verifyNoInteractions(credentials);
        server.verify();
    }

    @Test void missingInboxTableMustNotRegisterDeliveryOrClaimReadiness() {
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("Inbox unavailable")).when(inbox).checkStorage();
        var result = registration.register();
        assertEquals(false, result.get("ready"));
        assertEquals(0, result.get("activeTopics"));
        verifyNoInteractions(credentials);
        server.verify();
    }
    @Test void permissionDeniedOnOneTopicDoesNotClaimAllTopicsAreActive() throws Exception {
        probe(); existing("returns/request");
        server.expect(requestTo("https://test.myshopify.com/admin/api/2026-04/graphql.json"))
                .andExpect(jsonPath("$.variables.topic").value("RETURNS_REQUEST"))
                .andExpect(jsonPath("$.variables.subscription.uri").value(CALLBACK))
                .andRespond(withSuccess("{\"errors\":[{\"message\":\"Access denied\"}]}", MediaType.APPLICATION_JSON));
        var result = registration.register();
        assertEquals(false, result.get("ready"));
        assertEquals(ShopifyWebhookService.TOPICS.size() - 1, result.get("activeTopics"));
        server.verify();
    }
}
