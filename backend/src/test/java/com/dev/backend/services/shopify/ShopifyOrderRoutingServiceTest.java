package com.dev.backend.services.shopify;

import com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto;
import com.dev.backend.dto.channel.warehouse.KenhKhoMappingItemDto;
import com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta;
import com.dev.backend.entities.Kho;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShopifyOrderRoutingServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("buildFromOrderNode: Ánh xạ Location Shopify sang gợi ý Kho FCentric, nhận diện PICK_UP và đơn tách nhiều kho")
    void buildFromOrderNode_anhXaGoiYKho_Pickup_va_Split() throws Exception {
        DieuHanhHeThongService cfgService = mock(DieuHanhHeThongService.class);
        ShopifyOrderRoutingService routingService = new ShopifyOrderRoutingService(cfgService);

        KenhKhoMappingConfigDto mapCfg = KenhKhoMappingConfigDto.builder()
                .cheDoDaKho(true)
                .danhSachKho(List.of(
                        KenhKhoMappingItemDto.builder()
                                .maKhoSan("11111").tenKhoSan("HN Store")
                                .khoIdFCentric(1).laMacDinh(true).kichHoat(true).build(),
                        KenhKhoMappingItemDto.builder()
                                .maKhoSan("22222").tenKhoSan("HCM Branch")
                                .khoIdFCentric(2).laMacDinh(false).kichHoat(true).build()
                ))
                .build();
        List<Kho> activeKhos = List.of(
                Kho.builder().id(1).tenKho("Kho Tổng").trangThai(1).build(),
                Kho.builder().id(2).tenKho("Kho Chi Nhánh HCM").trangThai(1).build()
        );

        String orderJson = """
                {
                  "id": 987654,
                  "fulfillment_orders_gql": [
                    {
                      "id": "7001",
                      "status": "OPEN",
                      "assignedLocationId": "22222",
                      "assignedLocationName": "HCM Branch",
                      "deliveryMethodType": "PICK_UP",
                      "skus": ["AO-01"]
                    },
                    {
                      "id": "7002",
                      "status": "SCHEDULED",
                      "assignedLocationId": "11111",
                      "assignedLocationName": "HN Store",
                      "deliveryMethodType": "SHIPPING",
                      "skus": ["QUAN-02"]
                    }
                  ]
                }
                """;
        JsonNode orderNode = mapper.readTree(orderJson);

        ShopifyOrderRoutingMeta meta = routingService.buildFromOrderNode("987654", orderNode, mapCfg, activeKhos);

        assertNotNull(meta);
        assertEquals(2, meta.getKhoDeXuatId());
        assertEquals("Kho Chi Nhánh HCM", meta.getTenKhoDeXuat());
        assertEquals("22222", meta.getShopifyLocationId());
        assertEquals("PICK_UP", meta.getDeliveryMethodType());
        assertTrue(meta.isSplitMultiLocation(), "Đơn >= 2 FulfillmentOrder ở 2 Location phải gắn cờ splitMultiLocation");
        assertEquals(2, meta.getFulfillmentOrders().size());
    }

    @Test
    @DisplayName("save / find / isPickupOrder / remove: Lưu bền trong cau_hinh_he_thong và tự dọn khi kết thúc")
    void luuTraCuuVaXoaMetadata() {
        DieuHanhHeThongService cfgService = mock(DieuHanhHeThongService.class);
        AtomicReference<String> storedJson = new AtomicReference<>();
        when(cfgService.getCauHinhString(eq(ShopifyOrderRoutingService.CAU_HINH_SHOPIFY_DINH_TUYEN), any()))
                .thenAnswer(inv -> storedJson.get());
        doAnswer(inv -> {
            storedJson.set(inv.getArgument(1));
            return null;
        }).when(cfgService).setCauHinhString(eq(ShopifyOrderRoutingService.CAU_HINH_SHOPIFY_DINH_TUYEN), anyString());

        ShopifyOrderRoutingService writer = new ShopifyOrderRoutingService(cfgService);
        ShopifyOrderRoutingMeta meta = ShopifyOrderRoutingMeta.builder()
                .maDonHangKenh("555123")
                .khoDeXuatId(3)
                .tenKhoDeXuat("Kho Cần Thơ")
                .deliveryMethodType("PICK_UP")
                .updatedAtEpochSec(java.time.Instant.now().getEpochSecond())
                .build();
        writer.save(meta);

        // Nạp lại từ instance mới giả lập khởi động lại server
        ShopifyOrderRoutingService reader = new ShopifyOrderRoutingService(cfgService);
        assertTrue(reader.isPickupOrder("555123"));
        assertEquals(3, reader.find("555123").orElseThrow().getKhoDeXuatId());

        reader.remove("555123");
        assertFalse(reader.isPickupOrder("555123"));
        assertTrue(reader.find("555123").isEmpty());
    }
}
