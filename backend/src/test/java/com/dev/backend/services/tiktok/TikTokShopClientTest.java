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

    @Test
    @DisplayName("getCategoryAttributes: gọi GET đúng đường dẫn v202309 có category_version=v2 và locale")
    void getCategoryAttributes_thanhCong() {
        String appKey = "test_app_key";
        String appSecret = "test_app_secret";
        String accessToken = "test_access_token";
        String shopCipher = "ROW_TEST_CIPHER";
        String categoryId = "603729";

        String mockResponse = """
                {
                    "code": 0,
                    "message": "success",
                    "request_id": "req_attr_123",
                    "data": {
                        "attributes": [
                            {
                                "id": "100149",
                                "name": "Quốc gia xuất xứ",
                                "is_mandatory": true,
                                "type": "SINGLE_SELECT",
                                "values": [
                                    {"id": "1000100", "name": "Việt Nam"},
                                    {"id": "1000101", "name": "Trung Quốc"}
                                ]
                            }
                        ]
                    }
                }
                """;

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        when(restTemplate.exchange(urlCaptor.capture(), eq(HttpMethod.GET), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(mockResponse, HttpStatus.OK));

        com.fasterxml.jackson.databind.JsonNode res = client.getCategoryAttributes(appKey, appSecret, accessToken, shopCipher, categoryId, "vi-VN");

        assertNotNull(res);
        assertEquals(0, res.path("code").asInt());
        assertEquals(1, res.path("data").path("attributes").size());
        assertEquals("100149", res.path("data").path("attributes").get(0).path("id").asText());

        String capturedUrl = urlCaptor.getValue();
        assertTrue(capturedUrl.contains("/product/202309/categories/603729/attributes"));
        assertTrue(capturedUrl.contains("category_version=v2"));
        assertTrue(capturedUrl.contains("locale=vi-VN"));
        assertTrue(capturedUrl.contains("shop_cipher=" + shopCipher));
        assertTrue(capturedUrl.contains("sign="));
    }

    @Test
    @DisplayName("createProduct: payload chứa product_attributes với thuộc tính bắt buộc Quốc gia xuất xứ 100149")
    void createProduct_coProductAttributesQuocGiaXuatXu() throws Exception {
        TikTokProductCreateRequest payload = TikTokProductCreateRequest.builder()
                .title("Nike Sportswear - Thời trang FCentric chính hãng")
                .description("<p>Mô tả áo ngực thể thao</p>")
                .categoryId("603729")
                .categoryVersion("v2")
                .brandId("0")
                .mainImages(List.of(new TikTokProductCreateRequest.ImageUri("tos-maliva-i-o260ufnz6q-us/nike_sportswear")))
                .productAttributes(List.of(
                        TikTokProductCreateRequest.ProductAttribute.builder()
                                .id("100149")
                                .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                        .id("1000854")
                                        .name("Việt Nam")
                                        .build()))
                                .build(),
                        TikTokProductCreateRequest.ProductAttribute.builder()
                                .id("101489")
                                .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                        .name("Công ty Cổ phần Thời trang FCentric")
                                        .build()))
                                .build()
                ))
                .skus(List.of(
                        TikTokProductCreateRequest.CreateSku.builder()
                                .sellerSku("NIKE-SP-01")
                                .price(TikTokProductCreateRequest.SkuPrice.builder().amount("450000").currency("VND").build())
                                .build()
                ))
                .build();

        String json = objectMapper.writeValueAsString(payload);
        assertTrue(json.contains("\"product_attributes\":[{\"id\":\"100149\""), "Phải chứa product_attributes với id=100149");
        assertTrue(json.contains("\"name\":\"Việt Nam\""), "Phải chứa giá trị Việt Nam");
        assertTrue(json.contains("\"id\":\"1000854\""), "Phải chứa ID giá trị 1000854");
        assertTrue(json.contains("{\"id\":\"101489\""), "Phải chứa thuộc tính 101489 Tên tổ chức chịu trách nhiệm hàng hóa");
        assertTrue(json.contains("\"name\":\"Công ty Cổ phần Thời trang FCentric\""), "Phải chứa tên công ty");
    }

    @Test
    @DisplayName("uploadImageWithUseCase: gửi tham số use_case=SIZE_CHART_IMAGE khi tải ảnh bảng quy đổi kích cỡ")
    void uploadImageWithUseCase_sizeChartImage_thanhCong() {
        String appKey = "test_app_key";
        String appSecret = "test_app_secret";
        String accessToken = "test_access_token";
        String shopCipher = "ROW_TEST_CIPHER";
        byte[] fakeImageBytes = new byte[]{1, 2, 3, 4};

        String mockResponseBody = """
                {
                    "code": 0,
                    "message": "success",
                    "request_id": "test_upload_sc_123",
                    "data": {
                        "uri": "tos-maliva-i-o260ufnz6q-us/size_chart_test_uri",
                        "url": "https://p16-oec-va.ibyteimg.com/tos-maliva-i-o260ufnz6q-us/size_chart_test_uri~tplv-oec-image.jpeg"
                    }
                }
                """;

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> requestCaptor = ArgumentCaptor.forClass(HttpEntity.class);

        when(restTemplate.exchange(urlCaptor.capture(), eq(HttpMethod.POST), requestCaptor.capture(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(mockResponseBody, HttpStatus.OK));

        String uri = client.uploadImageWithUseCase(appKey, appSecret, accessToken, shopCipher, fakeImageBytes, "size_chart.jpg", "SIZE_CHART_IMAGE");

        assertNotNull(uri);
        assertEquals("tos-maliva-i-o260ufnz6q-us/size_chart_test_uri", uri);

        HttpEntity<MultiValueMap<String, Object>> capturedRequest = requestCaptor.getValue();
        assertNotNull(capturedRequest);
        MultiValueMap<String, Object> form = capturedRequest.getBody();
        assertNotNull(form);
        assertEquals("SIZE_CHART_IMAGE", form.getFirst("use_case"), "Body parameter use_case bắt buộc phải là SIZE_CHART_IMAGE");

        String capturedUrl = urlCaptor.getValue();
        assertFalse(capturedUrl.contains("shop_cipher="), "URL upload size chart không được chứa shop_cipher");
    }

    @Test
    @DisplayName("createProduct: payload chứa size_chart.image.uri hợp lệ theo quy định ngành hàng thời trang")
    void createProduct_coSizeChartImage() throws Exception {
        TikTokProductCreateRequest payload = TikTokProductCreateRequest.builder()
                .title("Áo Polo Jacquard Ultimate365 FCentric")
                .description("<p>Mô tả áo Polo</p>")
                .categoryId("960776")
                .categoryVersion("v2")
                .brandId("0")
                .mainImages(List.of(new TikTokProductCreateRequest.ImageUri("tos-maliva-i-o260ufnz6q-us/polo_main")))
                .sizeChart(TikTokProductCreateRequest.SizeChart.builder()
                        .image(TikTokProductCreateRequest.SizeChartImage.builder()
                                .uri("tos-maliva-i-o260ufnz6q-us/size_chart_uri_test")
                                .build())
                        .build())
                .skus(List.of(
                        TikTokProductCreateRequest.CreateSku.builder()
                                .sellerSku("POLO-01")
                                .price(TikTokProductCreateRequest.SkuPrice.builder().amount("299000").currency("VND").build())
                                .build()
                ))
                .build();

        String json = objectMapper.writeValueAsString(payload);
        assertTrue(json.contains("\"size_chart\":{\"image\":{\"uri\":\"tos-maliva-i-o260ufnz6q-us/size_chart_uri_test\"}}"),
                "Payload JSON bắt buộc chứa size_chart.image.uri");
    }

    @Test
    @DisplayName("getWarehouses: trích xuất danh sách kho TikTok Shop, phân biệt SALES_WAREHOUSE và RETURN_WAREHOUSE")
    void getWarehouses_thanhCong() {
        String appKey = "test_app_key";
        String appSecret = "test_app_secret";
        String accessToken = "test_access_token";
        String shopCipher = "ROW_TEST_CIPHER";

        String mockResponseBody = """
                {
                    "code": 0,
                    "message": "success",
                    "request_id": "test_wh_123",
                    "data": {
                        "warehouses": [
                            {
                                "id": "7702135691702454068",
                                "name": "F-Centric",
                                "type": "RETURN_WAREHOUSE",
                                "sub_type": "DOMESTIC_WAREHOUSE",
                                "is_default": false,
                                "effect_status": "ENABLED"
                            },
                            {
                                "id": "7702121381413914388",
                                "name": "F-Centric",
                                "type": "SALES_WAREHOUSE",
                                "sub_type": "DOMESTIC_WAREHOUSE",
                                "is_default": true,
                                "effect_status": "ENABLED"
                            }
                        ]
                    }
                }
                """;

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        when(restTemplate.exchange(urlCaptor.capture(), eq(HttpMethod.GET), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(mockResponseBody, HttpStatus.OK));

        com.dev.backend.dto.response.customize.TikTokWarehousesResponse res =
                client.getWarehouses(appKey, appSecret, accessToken, shopCipher);

        assertNotNull(res);
        assertEquals(0, res.getCode());
        assertNotNull(res.getWarehouses());
        assertEquals(2, res.getWarehouses().size());

        com.dev.backend.dto.response.customize.TikTokWarehouseDto returnWh = res.getWarehouses().get(0);
        assertEquals("7702135691702454068", returnWh.getId());
        assertEquals("RETURN_WAREHOUSE", returnWh.getType());
        assertFalse(returnWh.getIsDefault());

        com.dev.backend.dto.response.customize.TikTokWarehouseDto salesWh = res.getWarehouses().get(1);
        assertEquals("7702121381413914388", salesWh.getId());
        assertEquals("SALES_WAREHOUSE", salesWh.getType());
        assertTrue(salesWh.getIsDefault());

        String capturedUrl = urlCaptor.getValue();
        assertTrue(capturedUrl.contains(TikTokShopConstants.PATH_WAREHOUSES));
        assertTrue(capturedUrl.contains("shop_cipher=" + shopCipher));
    }
}
