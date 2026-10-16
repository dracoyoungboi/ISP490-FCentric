package com.dev.backend.services.impl.entities;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class ShopifySyncVulnerabilitiesTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Test 1: Fallback an toàn khi shop.json không có primary_location_id nhưng locations có duy nhất 1 địa điểm")
    void testSingleLocationFallbackSuccess() throws Exception {
        String shopWithoutPrimaryJson = """
        {
            "shop": {
                "id": 123456,
                "name": "Slm Global Store"
            }
        }
        """;

        String locationsSingleJson = """
        {
            "locations": [
                {
                    "id": 987654321,
                    "name": "Kho Chính Slm Global",
                    "active": true
                }
            ]
        }
        """;

        var shopNode = objectMapper.readTree(shopWithoutPrimaryJson);
        var locationsNode = objectMapper.readTree(locationsSingleJson);

        var diaDiem = KenhBanHangDongBoServiceImpl.chonDiaDiemMacDinh(shopNode, locationsNode);
        assertNotNull(diaDiem, "Đã có fallback an toàn, không còn bị null làm chặn cả gian hàng!");
        assertEquals(987654321L, diaDiem.id());
        assertEquals("Kho Chính Slm Global", diaDiem.ten());
    }

    @Test
    @DisplayName("Test 2: Bảo vệ không đoán khi có nhiều locations và thiếu primary_location_id")
    void testMultipleLocationsWithoutPrimaryReturnsNull() throws Exception {
        String shopWithoutPrimaryJson = "{\"shop\": {\"id\": 123456}}";
        String locationsMultiJson = """
        {
            "locations": [
                { "id": 111, "name": "Kho 1" },
                { "id": 222, "name": "Kho 2" }
            ]
        }
        """;

        var shopNode = objectMapper.readTree(shopWithoutPrimaryJson);
        var locationsNode = objectMapper.readTree(locationsMultiJson);

        var diaDiem = KenhBanHangDongBoServiceImpl.chonDiaDiemMacDinh(shopNode, locationsNode);
        assertNull(diaDiem, "Có từ 2 địa điểm trở lên mà không rõ primary_location_id thì bắt buộc trả null để không ghi nhầm");
    }

    @Test
    @DisplayName("Test 3: Khớp chính xác primary_location_id khi có nhiều locations")
    void testPrimaryLocationMatchWithMultipleLocations() throws Exception {
        String shopWithPrimaryJson = "{\"shop\": {\"primary_location_id\": 222}}";
        String locationsMultiJson = """
        {
            "locations": [
                { "id": 111, "name": "Kho 1" },
                { "id": 222, "name": "Kho 2" }
            ]
        }
        """;

        var shopNode = objectMapper.readTree(shopWithPrimaryJson);
        var locationsNode = objectMapper.readTree(locationsMultiJson);

        var diaDiem = KenhBanHangDongBoServiceImpl.chonDiaDiemMacDinh(shopNode, locationsNode);
        assertNotNull(diaDiem);
        assertEquals(222L, diaDiem.id());
        assertEquals("Kho 2", diaDiem.ten());
    }

    @Test
    @DisplayName("Test 4: phanLoaiLoiShopify phân loại 429 là loiCaKenh chuẩn contract")
    void testShopify429Contract() {
        KenhBanHangDongBoServiceImpl service = new KenhBanHangDongBoServiceImpl(
                null, null, null, null, null, null, null, null, null, null, null, null, null, null
        );

        var kq = service.phanLoaiLoiShopify(429, "{\"errors\": \"Exceeded 2 calls per second\"}");
        assertTrue(kq.loiKenh(), "429 khi hết retry vẫn đảm bảo contract loiCaKenh");
    }
}
