package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.customize.ShopifyTestConnectionResponse;
import com.dev.backend.repository.KenhBanHangRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShopifyConnectionPermissionTest {
    @ParameterizedTest
    @ValueSource(strings = {"write_merchant_managed_fulfillment_orders", "write_fulfillments", "unavailable"})
    void connectionAndProgressPermissionAreCheckedSeparately(String grantedScope) {
        var repository = mock(KenhBanHangRepository.class);
        var service = new KenhBanHangServiceImpl(repository, null, null, null);
        try (var construction = mockConstruction(RestTemplate.class, (rest, context) -> {
            when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                    .thenAnswer(call -> {
                        if (call.<String>getArgument(0).endsWith("/shop.json")) {
                            return ResponseEntity.ok("{\"shop\":{\"name\":\"Test\",\"myshopify_domain\":\"test.myshopify.com\"}}");
                        }
                        assertEquals("https://test.myshopify.com/admin/oauth/access_scopes.json", call.getArgument(0));
                        if ("unavailable".equals(grantedScope)) throw new HttpClientErrorException(HttpStatus.SERVICE_UNAVAILABLE);
                        return ResponseEntity.ok("{\"access_scopes\":[{\"handle\":\"" + grantedScope + "\"}]}");
                    });
        })) {
            ShopifyTestConnectionResponse result = service.testShopifyConnection(
                    ShopifyTestConnectionRequest.builder().shopDomain("test.myshopify.com").accessToken("test-key").build());
            assertTrue(result.isConnected());
            assertEquals(1, construction.constructed().size());
            if ("unavailable".equals(grantedScope)) {
                assertNull(result.getOrderProgressReady());
                assertNotNull(result.getOrderProgressWarning());
            } else {
                boolean ready = grantedScope.equals("write_merchant_managed_fulfillment_orders");
                assertEquals(ready, result.getOrderProgressReady());
                assertEquals(ready, result.getOrderProgressWarning() == null);
            }
        }
    }
}
