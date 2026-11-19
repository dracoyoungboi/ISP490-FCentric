package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.customize.ShopifyLocationDto;
import com.dev.backend.dto.response.customize.DayTonResultDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.PhieuXuatKho;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TonKhoTongHopRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.shopify.ShopifyMultiLocationClient;
import com.dev.backend.services.shopify.ShopifyOrderRoutingService;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class KenhBanHangShopifyMultiLocationTest {

    private KenhBanHangRepository kenhBanHangRepository;
    private TrangThaiDongBoSanPhamRepository trangThaiRepo;
    private BienTheSanPhamRepository bienTheRepo;
    private TonKhoTheoLoRepository tonKhoTheoLoRepo;
    private KenhBanHangService kenhBanHangService;
    private LichSuThayDoiService lichSuService;
    private NguoiDungRepository nguoiDungRepo;
    private AnhQuanAoRepository anhQuanAoRepo;
    private AnhBienTheRepository anhBienTheRepo;
    private MinioService minioService;
    private KhoRepository khoRepo;
    private TonKhoTongHopRepository tonKhoTongHopRepo;
    private OmnichannelOrderSyncJob orderSyncJob;
    private DieuHanhHeThongService dieuHanhHeThongService;
    private DonBanHangRepository donBanHangRepo;
    private PhieuXuatKhoRepository phieuXuatKhoRepo;
    private ShopifyMultiLocationClient shopifyMultiLocationClient;
    private ShopifyOrderRoutingService shopifyOrderRoutingService;
    private RestTemplate restTemplate;
    private KenhBanHangDongBoServiceImpl service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        kenhBanHangRepository = mock(KenhBanHangRepository.class);
        trangThaiRepo = mock(TrangThaiDongBoSanPhamRepository.class);
        bienTheRepo = mock(BienTheSanPhamRepository.class);
        tonKhoTheoLoRepo = mock(TonKhoTheoLoRepository.class);
        kenhBanHangService = mock(KenhBanHangService.class);
        lichSuService = mock(LichSuThayDoiService.class);
        nguoiDungRepo = mock(NguoiDungRepository.class);
        anhQuanAoRepo = mock(AnhQuanAoRepository.class);
        anhBienTheRepo = mock(AnhBienTheRepository.class);
        minioService = mock(MinioService.class);
        khoRepo = mock(KhoRepository.class);
        tonKhoTongHopRepo = mock(TonKhoTongHopRepository.class);
        orderSyncJob = mock(OmnichannelOrderSyncJob.class);
        dieuHanhHeThongService = mock(DieuHanhHeThongService.class);
        donBanHangRepo = mock(DonBanHangRepository.class);
        phieuXuatKhoRepo = mock(PhieuXuatKhoRepository.class);
        shopifyMultiLocationClient = mock(ShopifyMultiLocationClient.class);
        shopifyOrderRoutingService = mock(ShopifyOrderRoutingService.class);
        restTemplate = mock(RestTemplate.class);

        service = new KenhBanHangDongBoServiceImpl(
                kenhBanHangRepository, trangThaiRepo, bienTheRepo, tonKhoTheoLoRepo,
                kenhBanHangService, lichSuService, nguoiDungRepo, anhQuanAoRepo, anhBienTheRepo,
                minioService, khoRepo, tonKhoTongHopRepo, orderSyncJob, dieuHanhHeThongService
        );
        ReflectionTestUtils.setField(service, "donBanHangRepository", donBanHangRepo);
        ReflectionTestUtils.setField(service, "phieuXuatKhoRepository", phieuXuatKhoRepo);
        ReflectionTestUtils.setField(service, "shopifyMultiLocationClient", shopifyMultiLocationClient);
        ReflectionTestUtils.setField(service, "shopifyOrderRoutingService", shopifyOrderRoutingService);
    }

    @Test
    @DisplayName("dsDiaDiem: Lọc bỏ location active=false hoặc legacy=true và xếp primary lên đầu")
    void dsDiaDiem_locInactiveVaLegacy() throws Exception {
        JsonNode json = objectMapper.readTree("""
                {
                  "locations": [
                    { "id": 1001, "name": "Kho Tạm Ngưng", "active": false, "legacy": false },
                    { "id": 1002, "name": "Oberlo App", "active": true, "legacy": true },
                    { "id": 1003, "name": "Chi nhánh HCM", "active": true, "legacy": false },
                    { "id": 1004, "name": "Kho Tổng HN", "active": true, "legacy": false }
                  ]
                }
                """);
        List<ShopifyLocationDto> result = KenhBanHangDongBoServiceImpl.dsDiaDiem(json, 1004L);
        assertEquals(2, result.size());
        assertEquals("1004", result.get(0).getMaKhoSan());
        assertTrue(result.get(0).isMacDinh());
        assertEquals("1003", result.get(1).getMaKhoSan());
        assertFalse(result.get(1).isMacDinh());
    }

    @Test
    @DisplayName("buildTrackingLookupUrl: Sinh URL tra cứu chính xác cho ĐVVC nội địa VN và bỏ qua Tự giao/FCX-")
    void buildTrackingLookupUrl_dayDuDvvc() {
        assertEquals("https://donhang.ghn.vn/?order_code=GHN123",
                KenhBanHangDongBoServiceImpl.buildTrackingLookupUrl("Giao Hàng Nhanh", "GHN123"));
        assertEquals("https://i.ghtk.vn/S999",
                KenhBanHangDongBoServiceImpl.buildTrackingLookupUrl("GHTK", "S999"));
        assertEquals("https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?bill=VTP777",
                KenhBanHangDongBoServiceImpl.buildTrackingLookupUrl("Viettel Post", "VTP777"));
        assertEquals("https://spx.vn/track?SPXVN888",
                KenhBanHangDongBoServiceImpl.buildTrackingLookupUrl("SPX Express", "SPXVN888"));
        assertNull(KenhBanHangDongBoServiceImpl.buildTrackingLookupUrl("Tự giao", "TG-01"));
        assertNull(KenhBanHangDongBoServiceImpl.buildTrackingLookupUrl("GHN", "FCX-SO-001"));
    }

    @Test
    @DisplayName("guiTonLenShopify: Gặp lỗi 422 chưa kết nối Location tự gọi connectInventoryLevel rồi thử lại thành công")
    void guiTonLenShopify_tuDongConnectInventoryLevelKhi422() {
        HttpClientErrorException notConnected = HttpClientErrorException.create(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "Unprocessable Entity",
                new HttpHeaders(),
                "{\"errors\":\"Inventory item is not stocked at location\"}".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );
        when(shopifyMultiLocationClient.connectInventoryLevel("fcentric-test.myshopify.com", "shpat_123", 22222L, 555L))
                .thenReturn(true);

        java.util.concurrent.atomic.AtomicInteger callCount = new java.util.concurrent.atomic.AtomicInteger(0);
        try (MockedConstruction<RestTemplate> mockedRt = mockConstruction(RestTemplate.class, (mock, ctx) ->
                when(mock.exchange(
                        eq("https://fcentric-test.myshopify.com/admin/api/2024-01/inventory_levels/set.json"),
                        eq(HttpMethod.POST),
                        any(HttpEntity.class),
                        eq(String.class)))
                        .thenAnswer(inv -> {
                            if (callCount.getAndIncrement() == 0) {
                                throw notConnected;
                            }
                            return new ResponseEntity<>("{\"inventory_level\":{\"available\":12}}", HttpStatus.OK);
                        }))) {

            var res = service.guiTonLenShopify("fcentric-test.myshopify.com", "shpat_123", 22222L, 555L, 12);

            assertTrue(res.thanhCong());
            verify(shopifyMultiLocationClient).connectInventoryLevel("fcentric-test.myshopify.com", "shpat_123", 22222L, 555L);
            assertEquals(2, mockedRt.constructed().size());
        }
    }

    @Test
    @DisplayName("dayTonShopifyTheoLocMap: Delta Sync theo từng Location — bỏ qua Location không đổi và bắt được chuyển kho nội bộ (tổng không đổi)")
    void dayTonShopifyTheoLocMap_deltaSyncTheoTungLocationVaChuyenKhoNoiBo() {
        BienTheSanPham bt = BienTheSanPham.builder().id(88).maSku("POLO-M").build();
        TrangThaiDongBoSanPham dong = TrangThaiDongBoSanPham.builder()
                .id(1).bienTheSanPham(bt).trangThaiDongBo("cho_dong_bo").soLuongDaDay(0).build();
        var ketNoi = new KenhBanHangDongBoServiceImpl.KetNoiDayTon("shop.myshopify.com", "shpat_abc", 11111L, "Kho Chính", Map.of(), null);
        var vInfo = new KenhBanHangDongBoServiceImpl.ShopifyVariantInfo(1L, 999L, 2L, null);

        KenhBanHangDongBoServiceImpl spyService = spy(service);
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG)
                .when(spyService).guiTonLenShopify(anyString(), anyString(), anyLong(), anyLong(), anyInt());

        // Đợt 1: Tổng = 15 (11111L) + 5 (22222L) = 20 -> đẩy cả 2 Location
        Map<Long, Integer> dot1 = new LinkedHashMap<>();
        dot1.put(11111L, 15);
        dot1.put(22222L, 5);
        var kq1 = spyService.dayTonShopifyTheoLocMap(dong, ketNoi, vInfo, dot1);
        assertTrue(kq1.thanhCong());
        assertEquals(20, dong.getSoLuongDaDay());
        dong.setTrangThaiDongBo("thanh_cong");
        verify(spyService, times(1)).guiTonLenShopify("shop.myshopify.com", "shpat_abc", 11111L, 999L, 15);
        verify(spyService, times(1)).guiTonLenShopify("shop.myshopify.com", "shpat_abc", 22222L, 999L, 5);

        // Đợt 2: Chỉ Kho 11111L đổi (15 -> 14), Kho 22222L giữ 5 -> Bỏ qua 22222L, chỉ đẩy 11111L!
        clearInvocations(spyService);
        Map<Long, Integer> dot2 = new LinkedHashMap<>();
        dot2.put(11111L, 14);
        dot2.put(22222L, 5);
        var kq2 = spyService.dayTonShopifyTheoLocMap(dong, ketNoi, vInfo, dot2);
        assertTrue(kq2.thanhCong());
        assertEquals(19, dong.getSoLuongDaDay());
        verify(spyService, times(1)).guiTonLenShopify("shop.myshopify.com", "shpat_abc", 11111L, 999L, 14);
        verify(spyService, never()).guiTonLenShopify(anyString(), anyString(), eq(22222L), anyLong(), anyInt());

        // Đợt 3: Chuyển kho nội bộ 3 cái từ 11111L -> 22222L (11 & 8, tổng vẫn = 19!) -> Vẫn phải đẩy lại cả 2 Location!
        clearInvocations(spyService);
        Map<Long, Integer> dot3 = new LinkedHashMap<>();
        dot3.put(11111L, 11);
        dot3.put(22222L, 8);
        var kq3 = spyService.dayTonShopifyTheoLocMap(dong, ketNoi, vInfo, dot3);
        assertTrue(kq3.thanhCong());
        assertEquals(19, dong.getSoLuongDaDay());
        verify(spyService, times(1)).guiTonLenShopify("shop.myshopify.com", "shpat_abc", 11111L, 999L, 11);
        verify(spyService, times(1)).guiTonLenShopify("shop.myshopify.com", "shpat_abc", 22222L, 999L, 8);
    }

    @Test
    @DisplayName("dongBoSanSangLayTaiCuaHangShopify: Ủy quyền sang ShopifyMultiLocationClient.prepareForPickupIfApplicable")
    void dongBoSanSangLayTaiCuaHangShopify_uyQuyenClient() {
        KenhBanHang shopify = KenhBanHang.builder()
                .id(1).maKenh("SHOPIFY").apiUrl("https://fcentric-test.myshopify.com").apiKey("shpat_plain").apiSecret("shpat_plain").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopify));
        when(kenhBanHangService.getShopifyApiUrl()).thenReturn("https://fcentric-test.myshopify.com/admin/api/2024-01");
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn("shpat_plain");
        when(shopifyOrderRoutingService.isPickupOrder("99001")).thenReturn(true);
        when(shopifyOrderRoutingService.isPickupOrder("99002")).thenReturn(false);
        when(shopifyMultiLocationClient.prepareForPickupIfApplicable("fcentric-test.myshopify.com", "shpat_plain", "99001"))
                .thenReturn(true);

        assertTrue(service.dongBoSanSangLayTaiCuaHangShopify("99001"));
        verify(shopifyMultiLocationClient).prepareForPickupIfApplicable("fcentric-test.myshopify.com", "shpat_plain", "99001");

        assertFalse(service.dongBoSanSangLayTaiCuaHangShopify("99002"));
        verify(shopifyMultiLocationClient, never()).prepareForPickupIfApplicable(anyString(), anyString(), eq("99002"));
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("dongBoTrangThaiFulfilledShopify: Trích ĐVVC + mã vận đơn từ ghi chú DispatchDialog trên PXK và gửi kèm URL tra cứu lên Shopify")
    void dongBoTrangThaiFulfilledShopify_guiTrackingTuDispatchDialogVaUrlVn() {
        KenhBanHang shopify = KenhBanHang.builder()
                .id(1).maKenh("SHOPIFY").apiUrl("https://fcentric-test.myshopify.com").apiKey("shpat_plain").apiSecret("shpat_plain").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopify));
        when(kenhBanHangService.getShopifyApiUrl()).thenReturn("https://fcentric-test.myshopify.com/admin/api/2024-01");
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn("shpat_plain");

        DonBanHang don = DonBanHang.builder().id(500).soDonHang("SHP-1009").maDonHangKenh("777888").kenhBanHang(shopify).build();
        when(donBanHangRepo.findById(500)).thenReturn(Optional.of(don));
        PhieuXuatKho pxk = PhieuXuatKho.builder()
                .id(800)
                .ghiChu("[Vận chuyển: Giao Hàng Nhanh - Vận đơn: GHN888999 - Cước: 25.000]")
                .build();
        when(phieuXuatKhoRepo.findByDonBanHangId(500)).thenReturn(List.of(pxk));

        List<Map<String, Object>> capturedFulfillBodies = new ArrayList<>();
        try (MockedConstruction<RestTemplate> ignored = mockConstruction(RestTemplate.class, (mock, ctx) ->
                when(mock.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                        .thenAnswer(inv -> {
                            String url = inv.getArgument(0);
                            HttpMethod method = inv.getArgument(1);
                            if (url.contains("fulfillment_orders.json")) {
                                return new ResponseEntity<>(
                                        "{\"fulfillment_orders\":[{\"id\":91001,\"status\":\"open\",\"supported_actions\":[\"create_fulfillment\"],\"line_items\":[{\"id\":11,\"remaining_quantity\":1}]}]}",
                                        HttpStatus.OK);
                            }
                            if (url.endsWith("/fulfillments.json") && method == HttpMethod.POST) {
                                HttpEntity<?> ent = inv.getArgument(2);
                                capturedFulfillBodies.add((Map<String, Object>) ent.getBody());
                                return new ResponseEntity<>("{\"fulfillment\":{\"id\":555001,\"status\":\"success\"}}", HttpStatus.CREATED);
                            }
                            return new ResponseEntity<>("{\"order\":{\"id\":777888,\"tags\":\"\",\"note\":\"\"}}", HttpStatus.OK);
                        }))) {

            boolean ok = service.dongBoTrangThaiFulfilledShopify(500, "777888");

            assertTrue(ok);
            assertEquals(1, capturedFulfillBodies.size());
            Map<String, Object> fulfillment = (Map<String, Object>) capturedFulfillBodies.get(0).get("fulfillment");
            assertEquals(Boolean.FALSE, fulfillment.get("notify_customer"));
            Map<String, Object> tracking = (Map<String, Object>) fulfillment.get("tracking_info");
            assertEquals("Giao Hàng Nhanh", tracking.get("company"));
            assertEquals("GHN888999", tracking.get("number"));
            assertEquals("https://donhang.ghn.vn/?order_code=GHN888999", tracking.get("url"));
        }
    }

    @Test
    @DisplayName("chuyenKhoShopifyTheoKhoFCentric: Ánh xạ kho FCentric sang Shopify Location và gọi moveOpenFulfillmentOrdersToLocation")
    void chuyenKhoShopifyTheoKhoFCentric_goiMoveDungLocation() {
        KenhBanHang shopify = KenhBanHang.builder()
                .id(1).maKenh("SHOPIFY").apiUrl("https://fcentric-test.myshopify.com").apiKey("shpat_plain").apiSecret("shpat_plain").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopify));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn("shpat_plain");

        String mappingJson = """
                {
                  "cheDoDaKho": true,
                  "danhSachKho": [
                    { "maKhoSan": "11111", "tenKhoSan": "Kho Tổng", "khoIdFCentric": 1, "laMacDinh": true, "kichHoat": true },
                    { "maKhoSan": "22222", "tenKhoSan": "HCM Store", "khoIdFCentric": 2, "laMacDinh": false, "kichHoat": true }
                  ]
                }
                """;
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_SHOPIFY_KHO_MAPPING"), any())).thenReturn(mappingJson);
        when(shopifyMultiLocationClient.moveOpenFulfillmentOrdersToLocation(
                "fcentric-test.myshopify.com", "shpat_plain", "888999", "22222")).thenReturn(true);

        assertTrue(service.chuyenKhoShopifyTheoKhoFCentric("888999", 2));
        verify(shopifyMultiLocationClient).moveOpenFulfillmentOrdersToLocation(
                "fcentric-test.myshopify.com", "shpat_plain", "888999", "22222");
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("dongBoTrangThaiFulfilledShopify (Split Order): Chỉ fulfill đúng FulfillmentOrder tại Location ứng với don.khoXuat")
    void dongBoTrangThaiFulfilledShopify_multiFo_chiFulfillDungFoCuaKhoXuat() {
        KenhBanHang shopify = KenhBanHang.builder()
                .id(1).maKenh("SHOPIFY").apiUrl("https://fcentric-test.myshopify.com").apiKey("shpat_plain").apiSecret("shpat_plain").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopify));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn("shpat_plain");

        String mappingJson = """
                {
                  "cheDoDaKho": true,
                  "danhSachKho": [
                    { "maKhoSan": "11111", "tenKhoSan": "Kho Tổng", "khoIdFCentric": 1, "laMacDinh": true, "kichHoat": true },
                    { "maKhoSan": "22222", "tenKhoSan": "HCM Store", "khoIdFCentric": 2, "laMacDinh": false, "kichHoat": true }
                  ]
                }
                """;
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_SHOPIFY_KHO_MAPPING"), any())).thenReturn(mappingJson);

        com.dev.backend.entities.Kho khoHcm = com.dev.backend.entities.Kho.builder().id(2).maKho("CN_HCM").tenKho("Kho HCM").build();
        DonBanHang don = DonBanHang.builder().id(501).soDonHang("SHP-1010").maDonHangKenh("777999").khoXuat(khoHcm).kenhBanHang(shopify).build();
        when(donBanHangRepo.findById(501)).thenReturn(Optional.of(don));
        when(phieuXuatKhoRepo.findByDonBanHangId(501)).thenReturn(List.of());

        List<Map<String, Object>> capturedFulfillBodies = new ArrayList<>();
        String twoFosJson = """
                {
                  "fulfillment_orders": [
                    { "id": 91001, "status": "open", "assigned_location_id": 11111, "supported_actions": ["create_fulfillment"], "line_items": [{"id": 1, "remaining_quantity": 1}] },
                    { "id": 91002, "status": "open", "assigned_location_id": 22222, "supported_actions": ["create_fulfillment"], "line_items": [{"id": 2, "remaining_quantity": 1}] }
                  ]
                }
                """;
        try (MockedConstruction<RestTemplate> ignored = mockConstruction(RestTemplate.class, (mock, ctx) ->
                when(mock.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                        .thenAnswer(inv -> {
                            String url = inv.getArgument(0);
                            HttpMethod method = inv.getArgument(1);
                            if (url.contains("fulfillment_orders.json")) {
                                return new ResponseEntity<>(twoFosJson, HttpStatus.OK);
                            }
                            if (url.endsWith("/fulfillments.json") && method == HttpMethod.POST) {
                                HttpEntity<?> ent = inv.getArgument(2);
                                capturedFulfillBodies.add((Map<String, Object>) ent.getBody());
                                return new ResponseEntity<>("{\"fulfillment\":{\"id\":555002,\"status\":\"success\"}}", HttpStatus.CREATED);
                            }
                            return new ResponseEntity<>("{\"order\":{\"id\":777999,\"tags\":\"\",\"note\":\"\"}}", HttpStatus.OK);
                        }))) {

            assertTrue(service.dongBoTrangThaiFulfilledShopify(501, "777999"));
            Map<String, Object> fulfillment = (Map<String, Object>) capturedFulfillBodies.get(0).get("fulfillment");
            List<Map<String, Object>> foLines = (List<Map<String, Object>>) fulfillment.get("line_items_by_fulfillment_order");
            assertEquals(1, foLines.size());
            assertEquals(91002L, ((Number) foLines.get(0).get("fulfillment_order_id")).longValue());
        }
    }
}
