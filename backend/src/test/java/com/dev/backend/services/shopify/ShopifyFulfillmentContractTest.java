package com.dev.backend.services.shopify;

import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.impl.entities.KenhBanHangDongBoServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShopifyFulfillmentContractTest {
    @Mock KenhBanHangRepository channels;
    @Mock DonBanHangRepository orders;
    @Mock KenhBanHangService credentials;
    @InjectMocks KenhBanHangDongBoServiceImpl service;
    private final ObjectMapper mapper = new ObjectMapper();
    private final List<String> writes = new ArrayList<>();
    private final List<JsonNode> payloads = new ArrayList<>();
    private String fulfillmentOrders = "{\"fulfillment_orders\":[]}";
    private String fulfillments = "{\"fulfillments\":[{\"id\":44}]}";
    private String nativeState = "unfulfilled";
    private boolean denyEvent;
    private boolean alreadyError;
    private String refundOrder;

    @BeforeEach
    void setup() {
        org.springframework.test.util.ReflectionTestUtils.setField(service, "donBanHangRepository", orders);
        when(channels.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(KenhBanHang.builder()
                .maKenh("SHOPIFY").apiUrl("https://test.myshopify.com").build()));
        when(credentials.getDecryptedShopifyAccessToken()).thenReturn("test-key");
    }

    private MockedConstruction<RestTemplate> http() {
        return mockConstruction(RestTemplate.class, (rest, context) ->
                when(rest.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                        .thenAnswer(call -> {
                            String url = call.getArgument(0);
                            HttpMethod method = call.getArgument(1);
                            if (method != HttpMethod.GET) {
                                writes.add(url);
                                payloads.add(mapper.valueToTree(call.<HttpEntity<?>>getArgument(2).getBody()));
                            }
                            if (url.endsWith("/fulfillment_orders.json")) return ResponseEntity.ok(fulfillmentOrders);
                            if (refundOrder != null && method == HttpMethod.GET && url.endsWith("/orders/123.json")) return ResponseEntity.ok(refundOrder);
                            if (url.endsWith("/refunds/calculate.json")) return ResponseEntity.ok("{\"refund\":{\"suggested_transactions\":[{\"parent_id\":5,\"amount\":\"50000.00\",\"gateway\":\"manual\"}]}}");
                            if (url.endsWith("/refunds.json")) return ResponseEntity.ok("{\"refund\":{\"id\":66}}");
                            if (url.contains("fields=id,fulfillment_status")) return ResponseEntity.ok("{\"order\":{\"fulfillment_status\":\"" + nativeState + "\"}}");
                            if (url.endsWith("/fulfillments.json") && method == HttpMethod.GET) return ResponseEntity.ok(fulfillments);
                            if (url.endsWith("/fulfillments.json") && method == HttpMethod.POST) {
                                if (alreadyError) throw HttpClientErrorException.create(HttpStatus.UNPROCESSABLE_ENTITY, "already processing", HttpHeaders.EMPTY, "already processing".getBytes(), null);
                                return ResponseEntity.ok("{\"fulfillment\":{\"id\":44,\"status\":\"success\"}}");
                            }
                            if (url.endsWith("/events.json")) {
                                if (denyEvent) throw new HttpClientErrorException(HttpStatus.FORBIDDEN);
                                return ResponseEntity.ok("{\"fulfillment_event\":{\"id\":55,\"status\":\"delivered\"}}");
                            }
                            return ResponseEntity.ok("{\"order\":{\"id\":123,\"tags\":\"\",\"note\":\"\"}}");
                        }));
    }

    private void pendingItems() {
        fulfillmentOrders = """
                {"fulfillment_orders":[{"id":11,"status":"in_progress","line_items":[
                  {"id":21,"quantity":5,"fulfillable_quantity":2},
                  {"id":22,"quantity":1,"fulfillable_quantity":0}]}]}
                """;
    }

    @Test
    void fulfillsOnlyRemainingLineItemsAfterPhysicalDispatch() {
        pendingItems();
        try (var ignored = http()) {
            assertTrue(service.dongBoTrangThaiFulfilledShopify(1, "123"));
            JsonNode fulfillment = payloads.get(0).path("fulfillment");
            var items = fulfillment.path("line_items_by_fulfillment_order").get(0).path("fulfillment_order_line_items");
            assertEquals(1, items.size());
            assertEquals(21, items.get(0).path("id").asInt());
            assertEquals(2, items.get(0).path("quantity").asInt());
            assertFalse(fulfillment.path("notify_customer").asBoolean());
        }
    }

    @Test
    void emptyFulfillmentOrdersMustNotMeanFulfilled() {
        try (var ignored = http()) {
            assertFalse(service.dongBoTrangThaiFulfilledShopify(1, "123"));
            assertTrue(writes.isEmpty());
        }
    }

    @Test
    void nativeAlreadyFulfilledIsIdempotentWithoutAnotherFulfillment() {
        nativeState = "fulfilled";
        try (var ignored = http()) {
            assertTrue(service.dongBoTrangThaiFulfilledShopify(1, "123"));
            assertTrue(writes.stream().noneMatch(url -> url.endsWith("/fulfillments.json")));
        }
    }

    @Test
    void alreadyProcessing422DoesNotMeanAlreadyFulfilled() {
        pendingItems();
        alreadyError = true;
        try (var ignored = http()) {
            assertFalse(service.dongBoTrangThaiFulfilledShopify(1, "123"));
            assertEquals(1, writes.size());
        }
    }

    @Test
    void missingFulfillmentCannotBecomeDelivered() {
        fulfillments = "{\"fulfillments\":[]}";
        try (var ignored = http()) {
            assertFalse(service.dongBoTrangThaiDeliveredShopify("123"));
            assertTrue(writes.isEmpty());
        }
    }

    @Test
    void deniedDeliveryEventDoesNotAddDeliveredTagOrReportSuccess() {
        denyEvent = true;
        try (var ignored = http()) {
            assertFalse(service.dongBoTrangThaiDeliveredShopify("123"));
            assertEquals(1, writes.size());
            assertTrue(writes.get(0).endsWith("/events.json"));
        }
    }

    @Test
    void deliveryMustBeConfirmedByEventResponse() {
        try (var ignored = http()) {
            assertTrue(service.dongBoTrangThaiDeliveredShopify("123"));
            assertEquals("delivered", payloads.get(0).path("event").path("status").asText());
        }
    }

    @Test
    void fullReturnUsesCalculatedAmountAndNeverRestocksBeforeWarehouseReceipt() {
        refundOrder = "{\"order\":{\"id\":123,\"fulfillment_status\":\"fulfilled\",\"currency\":\"VND\",\"line_items\":[{\"id\":21,\"quantity\":2}]}}";
        try (var ignored = http()) {
            assertTrue(service.dongBoHoanTraVaHoanTienShopify(1, "123"));
            int index = -1;
            for (int i = 0; i < writes.size(); i++) if (writes.get(i).endsWith("/refunds.json")) index = i;
            assertTrue(index >= 0);
            JsonNode refund = payloads.get(index).path("refund");
            assertEquals("no_restock", refund.path("refund_line_items").get(0).path("restock_type").asText());
            assertEquals(2, refund.path("refund_line_items").get(0).path("quantity").asInt());
            assertEquals("50000.00", refund.path("transactions").get(0).path("amount").asText());
            assertFalse(refund.path("notify").asBoolean());
            verifyNoInteractions(orders);
        }
    }
}
