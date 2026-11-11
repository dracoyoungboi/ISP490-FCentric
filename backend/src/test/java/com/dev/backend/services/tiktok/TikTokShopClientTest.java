package com.dev.backend.services.tiktok;

import com.dev.backend.constants.TikTokShopConstants;
import com.dev.backend.dto.request.TikTokProductCreateRequest;
import com.dev.backend.dto.response.customize.TikTokProductCreateResponse;
import com.dev.backend.i18n.LoiThamSoException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.*;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TikTokShopClientTest {

    @Mock
    private RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private TikTokShopClient client;

    @BeforeEach
    void setUp() {
        client = new TikTokShopClient(restTemplate, objectMapper);
    }

    @Test
    @DisplayName("uploadImage: URL không chứa shop_cipher và form data có use_case=MAIN_IMAGE")
    void uploadImage_thanhCong_khongCoShopCipherVaCoUseCase() {
        String appKey = "test_app_key";
        String appSecret = "test_app_secret";
        String accessToken = "test_access_token";
        String shopCipher = "ROW_IGNORE_CIPHER";
        byte[] imageBytes = new byte[]{1, 2, 3, 4};
        String fileName = "product.jpg";

        String mockResponseBody = """
                {
                    "code": 0,
                    "message": "Success",
                    "request_id": "test_req_123",
                    "data": {
                        "uri": "tos-maliva-i-o260ufnz6q-us/uploaded_image_abc",
                        "url": "https://p-oec-va.ibyteimg.com/test.jpg",
                        "use_case": "MAIN_IMAGE"
                    }
                }
                """;

        ResponseEntity<String> responseEntity = new ResponseEntity<>(mockResponseBody, HttpStatus.OK);

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> requestCaptor = ArgumentCaptor.forClass(HttpEntity.class);

        when(restTemplate.exchange(urlCaptor.capture(), eq(HttpMethod.POST), requestCaptor.capture(), eq(String.class)))
                .thenReturn(responseEntity);

        String uri = client.uploadImage(appKey, appSecret, accessToken, shopCipher, imageBytes, fileName);

        assertEquals("tos-maliva-i-o260ufnz6q-us/uploaded_image_abc", uri);

        // 1. Kiểm tra URL không được chứa tham số shop_cipher để tránh lỗi 36009004 từ TikTok Gateway
        String capturedUrl = urlCaptor.getValue();
        assertNotNull(capturedUrl);
        assertTrue(capturedUrl.contains("app_key=" + appKey));
        assertTrue(capturedUrl.contains("timestamp="));
        assertTrue(capturedUrl.contains("sign="));
        assertFalse(capturedUrl.contains("shop_cipher="), "URL upload ảnh tuyệt đối không được chứa shop_cipher!");

        // 2. Kiểm tra Header và Body
        HttpEntity<MultiValueMap<String, Object>> capturedRequest = requestCaptor.getValue();
        assertNotNull(capturedRequest);
        HttpHeaders headers = capturedRequest.getHeaders();
        assertEquals(MediaType.MULTIPART_FORM_DATA, headers.getContentType());
        assertEquals(accessToken, headers.getFirst(TikTokShopConstants.HEADER_ACCESS_TOKEN));

        MultiValueMap<String, Object> form = capturedRequest.getBody();
        assertNotNull(form);
        assertTrue(form.containsKey("data"), "Phải có field binary data");
        assertEquals("MAIN_IMAGE", form.getFirst("use_case"), "Body parameter use_case bắt buộc phải là MAIN_IMAGE");
    }

    @Test
    @DisplayName("uploadImage: ném LoiThamSoException khi accessToken rỗng")
    void uploadImage_accessTokenRong_nemException() {
        assertThrows(LoiThamSoException.class, () ->
                client.uploadImage("key", "secret", "", "cipher", new byte[]{1}, "img.jpg"));
    }

    @Test
    @DisplayName("uploadImage: trả về null khi mảng byte ảnh rỗng")
    void uploadImage_anhRong_traVeNull() {
        String uri = client.uploadImage("key", "secret", "token", "cipher", new byte[0], "img.jpg");
        assertNull(uri);
        verifyNoInteractions(restTemplate);
    }

    @Test
    @DisplayName("createProduct: gửi request JSON chứa category_version=v2 và loại bỏ các trường null")
    void createProduct_thanhCong() throws Exception {
        String appKey = "test_app_key";
        String appSecret = "test_app_secret";
        String accessToken = "test_access_token";
        String shopCipher = "ROW_TEST_CIPHER";

        TikTokProductCreateRequest payload = TikTokProductCreateRequest.builder()
                .title("Áo sơ mi nam công sở cao cấp FCentric")
                .description("<p>Mô tả áo sơ mi</p>")
                .categoryId("1203984")
                .brandId("0")
                .mainImages(List.of(new TikTokProductCreateRequest.ImageUri("tos-maliva-i-o260ufnz6q-us/test")))
                .skus(List.of(
                        TikTokProductCreateRequest.CreateSku.builder()
                                .sellerSku("AO-SM-01")
                                .price(TikTokProductCreateRequest.SkuPrice.builder().amount("250000").currency("VND").build())
                                .build()
                ))
                .build();

        String mockResponseBody = """
                {
                    "code": 0,
                    "message": "success",
                    "request_id": "test_create_123",
                    "data": {
                        "product_id": "1729592969712207008",
                        "skus": [
                            {
                                "id": "1729592969712207011",
                                "seller_sku": "AO-SM-01"
                            }
                        ]
                    }
                }
                """;

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(mockResponseBody, HttpStatus.OK));

        TikTokProductCreateResponse res = client.createProduct(appKey, appSecret, accessToken, shopCipher, payload);

        assertNotNull(res);
        assertEquals(0, res.getCode());
        assertNotNull(res.getData());
        assertEquals("1729592969712207008", res.getData().getProductId());
        assertEquals(1, res.getData().getSkus().size());
        assertEquals("AO-SM-01", res.getData().getSkus().get(0).getSellerSku());
    }

    @Test
    @DisplayName("createProduct: với sản phẩm nhiều biến thể, sales_attributes phải có cả name, value_name và custom_value")
    void createProduct_multiSku_coDayDuValueNameVaCustomValue() throws Exception {
        String appKey = "test_app_key";
        String appSecret = "test_app_secret";
        String accessToken = "test_access_token";
        String shopCipher = "ROW_TEST_CIPHER";

        TikTokProductCreateRequest payload = TikTokProductCreateRequest.builder()
                .title("Áo khoác gió thể thao nam cao cấp FCentric")
                .description("<p>Mô tả áo khoác</p>")
                .categoryId("603706")
                .brandId("0")
                .mainImages(List.of(new TikTokProductCreateRequest.ImageUri("tos-maliva-i-o260ufnz6q-us/test")))
                .skus(List.of(
                        TikTokProductCreateRequest.CreateSku.builder()
                                .sellerSku("AK-DEN-L")
                                .price(TikTokProductCreateRequest.SkuPrice.builder().amount("350000").currency("VND").build())
                                .salesAttributes(List.of(
                                        TikTokProductCreateRequest.SalesAttribute.builder().name("Kích cỡ").valueName("L").customValue("L").build(),
                                        TikTokProductCreateRequest.SalesAttribute.builder().name("Màu sắc").valueName("Đen").customValue("Đen").build()
                                ))
                                .build(),
                        TikTokProductCreateRequest.CreateSku.builder()
                                .sellerSku("AK-DEN-XL")
                                .price(TikTokProductCreateRequest.SkuPrice.builder().amount("350000").currency("VND").build())
                                .salesAttributes(List.of(
                                        TikTokProductCreateRequest.SalesAttribute.builder().name("Kích cỡ").valueName("XL").customValue("XL").build(),
                                        TikTokProductCreateRequest.SalesAttribute.builder().name("Màu sắc").valueName("Đen").customValue("Đen").build()
                                ))
                                .build()
                ))
                .build();

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);

        String mockResponseBody = """
                {
                    "code": 0,
                    "message": "success",
                    "request_id": "test_create_multi",
                    "data": {
                        "product_id": "1729592969712207009",
                        "skus": [
                            {"id": "sku_1", "seller_sku": "AK-DEN-L"},
                            {"id": "sku_2", "seller_sku": "AK-DEN-XL"}
                        ]
                    }
                }
                """;

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(mockResponseBody, HttpStatus.OK));

        TikTokProductCreateResponse res = client.createProduct(appKey, appSecret, accessToken, shopCipher, payload);

        assertNotNull(res);
        assertEquals(0, res.getCode());
        assertEquals(2, res.getData().getSkus().size());

        // Kiểm tra payload serialize
        String json = objectMapper.writeValueAsString(payload);
        assertTrue(json.contains("\"value_name\":\"L\""), "JSON phải chứa value_name cho Kích cỡ");
        assertTrue(json.contains("\"custom_value\":\"L\""), "JSON phải chứa custom_value cho Kích cỡ");
        assertTrue(json.contains("\"value_name\":\"XL\""), "JSON phải chứa value_name cho biến thể thứ hai");
        assertTrue(json.contains("\"value_name\":\"Đen\""), "JSON phải chứa value_name cho Màu sắc");
    }
}
