package com.dev.backend.services.shopify;

import com.dev.backend.entities.KenhBanHang;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ShopifyWebhookServiceTest {
    ShopifyRealtimeConnection connection = mock(ShopifyRealtimeConnection.class);
    ShopifyWebhookInbox inbox = mock(ShopifyWebhookInbox.class);
    ShopifyWebhookWorker worker = mock(ShopifyWebhookWorker.class);
    ShopifyWebhookService service = new ShopifyWebhookService(connection, inbox, worker, new ObjectMapper());
    KenhBanHang channel = KenhBanHang.builder().id(2).build();
    @BeforeEach void setup() {
        when(connection.current()).thenReturn(channel);
        when(connection.domain(channel)).thenReturn("test.myshopify.com");
        when(connection.signingSecret(channel)).thenReturn("secret");
    }
    static String signature(byte[] raw) throws Exception {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getEncoder().encodeToString(mac.doFinal(raw));
    }
    void deliver(byte[] raw, String shop, String topic, String signature) {
        service.accept(raw, shop, topic, signature, "delivery-1");
    }
    @Test void authenticatesExactRawBodyBeforePersistingAndKicking() throws Exception {
        byte[] body = "{\n  \"id\": 123, \"note\": \"Tiếng Việt\"\n}".getBytes(StandardCharsets.UTF_8);
        deliver(body, "test.myshopify.com", "orders/updated", signature(body));
        var ordered = inOrder(inbox, worker);
        ordered.verify(inbox).accept(anyString(), eq("test.myshopify.com"), eq("Order"), eq("123"));
        ordered.verify(worker).kick();
    }
    @ParameterizedTest @ValueSource(strings = {"", "bad-base64", "c2lnbmF0dXJl"})
    void rejectsInvalidSignaturesWithoutAcceptingWork(String signature) {
        var error = assertThrows(ResponseStatusException.class, () -> deliver("{\"id\":123}".getBytes(), "test.myshopify.com", "orders/updated", signature));
        assertEquals(401, error.getStatusCode().value());
        verifyNoInteractions(inbox, worker);
    }
    @Test void doesNotTrustUnsignedShopHeader() throws Exception {
        byte[] body = "{\"id\":123}".getBytes();
        assertThrows(ResponseStatusException.class, () -> deliver(body, "other.myshopify.com", "orders/updated", signature(body)));
        verifyNoInteractions(inbox, worker);
    }
    @Test void progressPayloadWithoutOrderIdStoresFulfillmentReference() throws Exception {
        byte[] body = "{\"fulfillment_order\":{\"id\":\"gid://shopify/FulfillmentOrder/55\",\"status\":\"in_progress\"}}".getBytes();
        deliver(body, "test.myshopify.com", "fulfillment_orders/progress_reported", signature(body));
        verify(inbox).accept(anyString(), anyString(), eq("FulfillmentOrder"), eq("55"));
    }
    @Test void unavailableDatabaseMustNotAcknowledgeOrLoseDelivery() throws Exception {
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("unavailable")).when(inbox).accept(anyString(), anyString(), anyString(), anyString());
        byte[] body = "{\"id\":123}".getBytes();
        var error = assertThrows(ResponseStatusException.class, () -> deliver(body, "test.myshopify.com", "orders/updated", signature(body)));
        assertEquals(503, error.getStatusCode().value());
        verifyNoInteractions(worker);
    }
    @Test void tamperedBodyFailsEvenWithAValidSignatureForOriginal() throws Exception {
        String signature = signature("{\"id\":123}".getBytes());
        assertThrows(ResponseStatusException.class, () -> deliver("{\"id\":999}".getBytes(), "test.myshopify.com", "orders/updated", signature));
        verifyNoInteractions(inbox, worker);
    }

    @Test void repeatedIdenticalProgressWithNewDeliveryIdIsNotDiscarded() throws Exception {
        byte[] body = "{\"id\":123}".getBytes();
        service.accept(body, "test.myshopify.com", "orders/updated", signature(body), "delivery-1");
        service.accept(body, "test.myshopify.com", "orders/updated", signature(body), "delivery-2");
        var keys = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(inbox, times(2)).accept(keys.capture(), anyString(), anyString(), anyString());
        assertNotEquals(keys.getAllValues().get(0), keys.getAllValues().get(1));
    }

    @Test void httpEndpointPreservesRawJsonAndAcceptsOnlyAuthenticatedShopifyDelivery() throws Exception {
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
                new com.dev.backend.controller.ShopifyWebhookController(service))
                .setControllerAdvice(new com.dev.backend.exception.RestControllerGlobalExceptionHandler()).build();
        byte[] raw = "{\n \"id\":123\n}".getBytes(StandardCharsets.UTF_8);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(ShopifyWebhookService.PATH)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(raw)
                        .header("X-Shopify-Shop-Domain", "test.myshopify.com")
                        .header("X-Shopify-Topic", "orders/updated")
                        .header("X-Shopify-Webhook-Id", "delivery-1")
                        .header("X-Shopify-Hmac-Sha256", signature(raw)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        verify(worker).kick();
    }

    @Test void httpEndpointRejectsUnsignedTrafficBeforeWritingInbox() throws Exception {
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
                new com.dev.backend.controller.ShopifyWebhookController(service))
                .setControllerAdvice(new com.dev.backend.exception.RestControllerGlobalExceptionHandler()).build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(ShopifyWebhookService.PATH)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content("{\"id\":123}")
                        .header("X-Shopify-Shop-Domain", "test.myshopify.com")
                        .header("X-Shopify-Topic", "orders/updated")).andExpect(
                        org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        verifyNoInteractions(inbox, worker);
    }
}
