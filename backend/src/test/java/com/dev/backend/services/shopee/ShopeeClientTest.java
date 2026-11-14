package com.dev.backend.services.shopee;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShopeeClientTest {

    @Mock
    private RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private ShopeeClient client;

    @BeforeEach
    void setUp() {
        client = new ShopeeClient(1253449L, "mock_partner_key", 10001L, "test_token", true);
        ReflectionTestUtils.setField(client, "restTemplate", restTemplate);
        ReflectionTestUtils.setField(client, "objectMapper", objectMapper);
    }

    @Test
    @DisplayName("uploadImage: Mock credentials trả về mock image_id")
    void uploadImage_mockCredentials() {
        byte[] bytes = new byte[]{1, 2, 3};
        JsonNode res = client.uploadImage(bytes, "test.jpg");

        assertNotNull(res);
        assertEquals("", res.path("error").asText());
        String imgId = res.path("response").path("image_info").path("image_id").asText();
        assertNotNull(imgId);
        assertTrue(imgId.startsWith("vn-11134207-mock-"));
    }

    @Test
    @DisplayName("getLogisticsChannelList: Mock credentials trả về danh sách kênh bưu cục mặc định")
    void getLogisticsChannelList_mockCredentials() {
        JsonNode res = client.getLogisticsChannelList();

        assertNotNull(res);
        assertEquals("", res.path("error").asText());
        JsonNode channels = res.path("response").path("logistics_channel_list");
        assertTrue(channels.isArray());
        assertFalse(channels.isEmpty());
        assertEquals(80001L, channels.get(0).path("logistics_channel_id").asLong());
        assertTrue(channels.get(0).path("enabled").asBoolean());
    }

    @Test
    @DisplayName("getCategoryList: Mock credentials trả về danh mục thời trang")
    void getCategoryList_mockCredentials() {
        JsonNode res = client.getCategoryList("vi");

        assertNotNull(res);
        assertEquals("", res.path("error").asText());
        JsonNode catList = res.path("response").path("category_list");
        assertTrue(catList.isArray());
        assertEquals(100017L, catList.get(0).path("category_id").asLong());
    }

    @Test
    @DisplayName("addItem: Mock credentials sinh item_id ngẫu nhiên")
    void addItem_mockCredentials() {
        Map<String, Object> body = Map.of(
                "item_name", "Áo Polo Nam Thể Thao FCentric",
                "original_price", 250000.0,
                "category_id", 100017L
        );
        JsonNode res = client.addItem(body);

        assertNotNull(res);
        assertEquals("", res.path("error").asText());
        long itemId = res.path("response").path("item_id").asLong();
        assertTrue(itemId > 0);
    }

    @Test
    @DisplayName("initTierVariation: Mock credentials sinh model_id_list cho các biến thể")
    void initTierVariation_mockCredentials() {
        Map<String, Object> body = Map.of(
                "item_id", 1000101L,
                "tier_variation", List.of(Map.of("name", "Màu sắc", "options", List.of(Map.of("option", "Đen")))),
                "model", List.of(
                        Map.of("tier_index", List.of(0), "normal_price", 250000.0, "stock", 50, "model_sku", "POLO-BLK")
                )
        );
        JsonNode res = client.initTierVariation(body);

        assertNotNull(res);
        assertEquals("", res.path("error").asText());
        JsonNode modelList = res.path("response").path("model_id_list");
        assertTrue(modelList.isArray());
        assertEquals(1, modelList.size());
        assertEquals(2000001L, modelList.get(0).path("model_id").asLong());
    }

    @Test
    @DisplayName("addItem: Gọi API thật sinh URL chứa partner_id, shop_id, sign và gửi POST JSON")
    void addItem_realCall() {
        ShopeeClient realClient = new ShopeeClient(1253449L, "real_partner_key_1234567890abcdef", 99999L, "token_xyz", true);
        ReflectionTestUtils.setField(realClient, "restTemplate", restTemplate);
        ReflectionTestUtils.setField(realClient, "objectMapper", objectMapper);

        String mockResponse = "{\"error\": \"\", \"message\": \"success\", \"response\": {\"item_id\": 777888}}";
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(mockResponse));

        Map<String, Object> body = Map.of("item_name", "Áo Thun FCentric", "original_price", 199000.0);
        JsonNode res = realClient.addItem(body);

        assertNotNull(res);
        assertEquals(777888L, res.path("response").path("item_id").asLong());

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate).postForEntity(urlCaptor.capture(), any(HttpEntity.class), eq(String.class));
        String calledUrl = urlCaptor.getValue();
        assertTrue(calledUrl.contains("partner_id=1253449"));
        assertTrue(calledUrl.contains("shop_id=99999"));
        assertTrue(calledUrl.contains("sign="));
        assertTrue(calledUrl.contains("/api/v2/product/add_item"));
    }
}

