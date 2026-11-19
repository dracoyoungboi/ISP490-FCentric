package com.dev.backend.services.shopify;

import com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta.FulfillmentOrderSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShopifyMultiLocationClientTest {

    private RestTemplate restTemplate;
    private ObjectMapper objectMapper;
    private ShopifyMultiLocationClient client;

    @BeforeEach
    void setUp() {
        restTemplate = mock(RestTemplate.class);
        objectMapper = new ObjectMapper();
        client = new ShopifyMultiLocationClient(restTemplate, objectMapper);
    }

    @Test
    @DisplayName("fetchOrderBatchMeta: Đọc batch fulfillmentOrders + returnStatus trong 1 GraphQL call, bỏ SKU remainingQuantity = 0")
    void fetchOrderBatchMeta_traVeFulfillmentOrdersVaBoSkuDaHoanTat() {
        String gqlResponse = """
                {
                  "data": {
                    "nodes": [
                      {
                        "id": "gid://shopify/Order/9001",
                        "returnStatus": "NO_RETURN",
                        "fulfillmentOrders": {
                          "nodes": [
                            {
                              "id": "gid://shopify/FulfillmentOrder/7001",
                              "status": "OPEN",
                              "deliveryMethod": { "methodType": "SHIPPING" },
                              "assignedLocation": {
                                "location": {
                                  "id": "gid://shopify/Location/11111",
                                  "name": "Kho Ha Noi"
                                }
                              },
                              "lineItems": {
                                "nodes": [
                                  { "sku": "POLO-DEN-M", "remainingQuantity": 2 },
                                  { "sku": "POLO-TRANG-L", "remainingQuantity": 0 }
                                ]
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
                """;
        when(restTemplate.exchange(
                eq("https://fcentric-test.myshopify.com/admin/api/2026-04/graphql.json"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(String.class)))
                .thenReturn(new ResponseEntity<>(gqlResponse, HttpStatus.OK));

        Map<String, ShopifyMultiLocationClient.OrderGraphMeta> res = client.fetchOrderBatchMeta(
                "fcentric-test.myshopify.com",
                "shpat_test_token",
                List.of("9001"));

        assertEquals(1, res.size());
        ShopifyMultiLocationClient.OrderGraphMeta meta = res.get("9001");
        assertNotNull(meta);
        assertEquals("NO_RETURN", meta.returnStatus());
        assertEquals(1, meta.fulfillmentOrders().size());
        FulfillmentOrderSnapshot fo = meta.fulfillmentOrders().get(0);
        assertEquals("7001", fo.getId());
        assertEquals("OPEN", fo.getStatus());
        assertEquals("11111", fo.getAssignedLocationId());
        assertEquals("Kho Ha Noi", fo.getAssignedLocationName());
        assertEquals("SHIPPING", fo.getDeliveryMethodType());
        assertEquals(List.of("POLO-DEN-M"), fo.getSkus());
        verify(restTemplate, times(1)).exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));
    }

    @Test
    @DisplayName("moveOpenFulfillmentOrdersToLocation: Chỉ move FO OPEN/SCHEDULED khác location đích, bỏ qua FO đã cùng location hoặc CLOSED")
    void moveOpenFulfillmentOrdersToLocation_chuyenDungFoKhacLocation() {
        String singleQueryRes = """
                {
                  "data": {
                    "order": {
                      "id": "gid://shopify/Order/9002",
                      "fulfillmentOrders": {
                        "nodes": [
                          {
                            "id": "gid://shopify/FulfillmentOrder/8001",
                            "status": "OPEN",
                            "deliveryMethod": { "methodType": "SHIPPING" },
                            "supportedActions": [{ "action": "MOVE" }],
                            "assignedLocation": { "location": { "id": "gid://shopify/Location/11111", "name": "Kho HN" } }
                          },
                          {
                            "id": "gid://shopify/FulfillmentOrder/8002",
                            "status": "CLOSED",
                            "deliveryMethod": { "methodType": "SHIPPING" },
                            "supportedActions": [],
                            "assignedLocation": { "location": { "id": "gid://shopify/Location/11111", "name": "Kho HN" } }
                          },
                          {
                            "id": "gid://shopify/FulfillmentOrder/8003",
                            "status": "OPEN",
                            "deliveryMethod": { "methodType": "SHIPPING" },
                            "supportedActions": [{ "action": "MOVE" }],
                            "assignedLocation": { "location": { "id": "gid://shopify/Location/22222", "name": "Kho HCM" } }
                          }
                        ]
                      }
                    }
                  }
                }
                """;
        String moveMutationRes = """
                {
                  "data": {
                    "fulfillmentOrderMove": {
                      "movedFulfillmentOrder": {
                        "id": "gid://shopify/FulfillmentOrder/8001",
                        "status": "OPEN",
                        "assignedLocation": { "location": { "id": "gid://shopify/Location/22222", "name": "Kho HCM" } }
                      },
                      "userErrors": []
                    }
                  }
                }
                """;
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(singleQueryRes, HttpStatus.OK))
                .thenReturn(new ResponseEntity<>(moveMutationRes, HttpStatus.OK));

        boolean moved = client.moveOpenFulfillmentOrdersToLocation(
                "fcentric-test.myshopify.com",
                "shpat_test_token",
                "9002",
                "22222");

        assertTrue(moved);
        verify(restTemplate, times(2)).exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));
    }

    @Test
    @DisplayName("prepareForPickupIfApplicable: Gọi fulfillmentOrderLineItemsPreparedForPickup với đơn PICK_UP, bỏ qua đơn SHIPPING")
    void prepareForPickupIfApplicable_chiGoiVoiDonPickUp() {
        String singleQueryPickup = """
                {
                  "data": {
                    "order": {
                      "id": "gid://shopify/Order/9003",
                      "fulfillmentOrders": {
                        "nodes": [
                          {
                            "id": "gid://shopify/FulfillmentOrder/8101",
                            "status": "OPEN",
                            "deliveryMethod": { "methodType": "PICK_UP" },
                            "supportedActions": [],
                            "assignedLocation": { "location": { "id": "gid://shopify/Location/11111", "name": "Store HN" } }
                          }
                        ]
                      }
                    }
                  }
                }
                """;
        String pickupRes = """
                {
                  "data": {
                    "fulfillmentOrderLineItemsPreparedForPickup": {
                      "userErrors": []
                    }
                  }
                }
                """;
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(singleQueryPickup, HttpStatus.OK))
                .thenReturn(new ResponseEntity<>(pickupRes, HttpStatus.OK));

        assertTrue(client.prepareForPickupIfApplicable("fcentric-test.myshopify.com", "shpat_test_token", "9003"));
        verify(restTemplate, times(2)).exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));

        reset(restTemplate);
        String shippingOnly = singleQueryPickup.replace("PICK_UP", "SHIPPING");
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(shippingOnly, HttpStatus.OK));

        assertFalse(client.prepareForPickupIfApplicable("fcentric-test.myshopify.com", "shpat_test_token", "9003"));
        verify(restTemplate, times(1)).exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));
    }

    @Test
    @DisplayName("connectInventoryLevel & toNumericId: Gọi POST inventory_levels/connect.json và tách đúng numeric ID")
    void connectInventoryLevel_va_toNumericId() {
        assertEquals("998877", ShopifyMultiLocationClient.toNumericId("gid://shopify/Location/998877"));
        assertEquals("998877", ShopifyMultiLocationClient.toNumericId("998877"));
        assertNull(ShopifyMultiLocationClient.toNumericId("gid://shopify/Location/abc"));

        when(restTemplate.exchange(
                eq("https://fcentric-test.myshopify.com/admin/api/2024-01/inventory_levels/connect.json"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"inventory_level\":{\"inventory_item_id\":555,\"location_id\":22222}}", HttpStatus.CREATED));

        assertTrue(client.connectInventoryLevel("fcentric-test.myshopify.com", "shpat_test_token", 22222L, 555L));
    }
}
