package com.dev.backend.services.shopee;

import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.SanPhamQuanAoRepository;
import com.dev.backend.repository.TepTinRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.entities.KenhBanHangDongBoServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class ShopeeSyncUpsertTest {

    @Mock
    private KenhBanHangRepository kenhBanHangRepository;

    @Mock
    private KenhBanHangService kenhBanHangService;

    @Mock
    private BienTheSanPhamRepository bienTheSanPhamRepository;

    @Mock
    private TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;

    @Mock
    private SanPhamQuanAoRepository sanPhamQuanAoRepository;

    @Mock
    private AnhQuanAoRepository anhQuanAoRepository;

    @Mock
    private AnhBienTheRepository anhBienTheRepository;

    @Mock
    private TepTinRepository tepTinRepository;

    @Mock
    private MinioService minioService;

    @Mock
    private ShopeeClient shopeeClient;

    @InjectMocks
    private KenhBanHangDongBoServiceImpl dongBoService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(dongBoService, "objectMapper", objectMapper);
    }

    @Test
    @DisplayName("phanLoaiLoiShopee: Chuyển đổi mã lỗi async creating variation thành câu tiếng Việt thân thiện")
    void testPhanLoaiLoiShopeeAsyncVariation() {
        String rawErr = "error_param";
        String rawMsg = "The item is still being created. Please wait 5 seconds before creating variation.";
        String result = dongBoService.phanLoaiLoiShopee(rawErr, rawMsg);

        assertNotNull(result);
        assertEquals("Sản phẩm đang được Shopee khởi tạo ngầm. Vui lòng bấm Thử lại sau giây lát.", result);
    }

    @Test
    @DisplayName("phanLoaiLoiShopee: Chuyển đổi lỗi duplicate listing thành câu hướng dẫn người dùng")
    void testPhanLoaiLoiShopeeDuplicate() {
        String rawErr = "error_duplicate";
        String rawMsg = "The product has already been uploaded or duplicate listing detected.";
        String result = dongBoService.phanLoaiLoiShopee(rawErr, rawMsg);

        assertNotNull(result);
        assertEquals("Sản phẩm bị trùng lặp với bài đăng đã có trên Shopee. Hệ thống đã tự động đổi tên phân biệt.", result);
    }

    @Test
    @DisplayName("timCategoryIdShopee: Phân loại chuẩn Thời Trang Nam ID 100011 (Polo 100243, Jeans 100047)")
    void testTimCategoryIdShopeeMenFashion() {
        SanPhamQuanAo polo = SanPhamQuanAo.builder()
                .id(1)
                .tenSanPham("Áo polo siêu đẹp 365")
                .build();
        Long poloCatId = dongBoService.timCategoryIdShopee(polo, shopeeClient);
        assertNotNull(poloCatId);
        assertEquals(100243L, poloCatId, "Áo Polo Nam phải thuộc danh mục lá 100243 (Thời Trang Nam 100011)");

        SanPhamQuanAo jeans = SanPhamQuanAo.builder()
                .id(2)
                .tenSanPham("Quần Jeans Baggy Ống Cong Barrel")
                .build();
        Long jeansCatId = dongBoService.timCategoryIdShopee(jeans, shopeeClient);
        assertNotNull(jeansCatId);
        assertEquals(100047L, jeansCatId, "Quần Jean Nam phải thuộc danh mục lá 100047 (Thời Trang Nam 100011)");
    }

    @Test
    @DisplayName("layHoacCapNhatShopeeCatalog: Nạp và lưu cache danh mục Shopee trong 30 phút")
    void testShopeeCatalogCache() throws Exception {
        String itemListJson = """
                {
                  "error": "",
                  "message": "",
                  "response": {
                    "item": [
                      { "item_id": 998877, "item_status": "NORMAL" }
                    ],
                    "total_count": 1,
                    "has_next_page": false,
                    "next_offset": 0
                  }
                }
                """;
        String itemBaseInfoJson = """
                {
                  "error": "",
                  "message": "",
                  "response": {
                    "item_list": [
                      {
                        "item_id": 998877,
                        "item_name": "Áo polo siêu đẹp 365 - Thời trang FCentric chính hãng",
                        "item_sku": "AP2611011",
                        "has_model": true
                      }
                    ]
                  }
                }
                """;
        String modelListJson = """
                {
                  "error": "",
                  "message": "",
                  "response": {
                    "model": [
                      {
                        "model_id": 112233,
                        "model_sku": "AP2611011-CL001-S-MS-7330",
                        "tier_index": [0, 0]
                      }
                    ]
                  }
                }
                """;

        when(shopeeClient.getItemList(anyInt(), anyInt(), eq("NORMAL"))).thenReturn(objectMapper.readTree(itemListJson));
        when(shopeeClient.getItemList(anyInt(), anyInt(), eq("UNLIST"))).thenReturn(objectMapper.readTree("{\"response\":{\"item\":[]}}"));
        when(shopeeClient.getItemBaseInfo(anyList())).thenReturn(objectMapper.readTree(itemBaseInfoJson));
        when(shopeeClient.getModelList(998877L)).thenReturn(objectMapper.readTree(modelListJson));

        KenhBanHangDongBoServiceImpl.ShopeeCatalogCache cache = dongBoService.layHoacCapNhatShopeeCatalog(
                shopeeClient, "test_shop_123", true);

        assertNotNull(cache);
        assertTrue(cache.isValid());
        assertTrue(cache.titleToItemId().containsKey("áo polo siêu đẹp 365"));
        assertEquals(998877L, cache.titleToItemId().get("áo polo siêu đẹp 365"));
        assertTrue(cache.skuToTargetId().containsKey("ap2611011-cl001-s-ms-7330"));
        assertEquals("998877:112233", cache.skuToTargetId().get("ap2611011-cl001-s-ms-7330"));

        // Lần gọi thứ 2 với forceRefresh = false -> tái sử dụng cache RAM không gọi lại client
        reset(shopeeClient);
        KenhBanHangDongBoServiceImpl.ShopeeCatalogCache cachedSecond = dongBoService.layHoacCapNhatShopeeCatalog(
                shopeeClient, "test_shop_123", false);
        assertSame(cache, cachedSecond);
        verifyNoInteractions(shopeeClient);
    }
}
