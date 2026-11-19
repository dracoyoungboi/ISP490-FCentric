package com.dev.backend.services.shopify;

import com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto;
import com.dev.backend.dto.response.customize.ShopifyLocationDto;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.Kho;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class ShopifyMultiLocationInventoryTest {

    @Mock
    private KenhBanHangRepository kenhBanHangRepository;

    @Mock
    private KenhBanHangService kenhBanHangService;

    @Mock
    private KhoRepository khoRepository;

    @Mock
    private DieuHanhHeThongService dieuHanhHeThongService;

    @Mock
    private com.dev.backend.services.impl.entities.LichSuThayDoiService lichSuThayDoiService;

    @Mock
    private com.dev.backend.repository.NguoiDungRepository nguoiDungRepository;

    @InjectMocks
    private KenhBanHangDongBoServiceImpl dongBoService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(dongBoService, "objectMapper", objectMapper);
        ReflectionTestUtils.setField(dongBoService, "kenhBanHangRepository", kenhBanHangRepository);
        ReflectionTestUtils.setField(dongBoService, "kenhBanHangService", kenhBanHangService);
        ReflectionTestUtils.setField(dongBoService, "khoRepository", khoRepository);
        ReflectionTestUtils.setField(dongBoService, "dieuHanhHeThongService", dieuHanhHeThongService);
        ReflectionTestUtils.setField(dongBoService, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(dongBoService, "nguoiDungRepository", nguoiDungRepository);
    }

    @Test
    @DisplayName("tinhSoTonDayPhanBo: Phân bổ tỷ lệ tồn đệm chính xác khi số lượng tồn lớn")
    void testTinhSoTonDayPhanBo_tiLeVaTonDemChuan() {
        BigDecimal tongKhaDung = BigDecimal.valueOf(100);
        BigDecimal tyLe = BigDecimal.valueOf(100);
        int tonDemTong = 3;
        int nguongVe0 = 0;

        // Kho A có 60 cái (60%): Đệm = round(3 * 60 / 100) = 2 -> Số đẩy = 60 - 2 = 58
        int soDayKhoA = dongBoService.tinhSoTonDayPhanBo(BigDecimal.valueOf(60), tongKhaDung, tyLe, tonDemTong, nguongVe0);
        assertEquals(58, soDayKhoA);

        // Kho B có 40 cái (40%): Đệm = round(3 * 40 / 100) = 1 -> Số đẩy = 40 - 1 = 39
        int soDayKhoB = dongBoService.tinhSoTonDayPhanBo(BigDecimal.valueOf(40), tongKhaDung, tyLe, tonDemTong, nguongVe0);
        assertEquals(39, soDayKhoB);

        // Tổng đẩy = 58 + 39 = 97, đúng bằng 100 - 3 (tồn đệm tổng)
        assertEquals(97, soDayKhoA + soDayKhoB);
    }

    @Test
    @DisplayName("tinhSoTonDayPhanBo: Dynamic Low-Stock Safeguard chống giam hàng lẻ size/lẻ màu")
    void testTinhSoTonDayPhanBo_dynamicLowStockSafeguard() {
        BigDecimal tongKhaDung = BigDecimal.valueOf(3);
        BigDecimal tyLe = BigDecimal.valueOf(100);
        int tonDemTong = 5; // Cấu hình đệm tổng 5 nhưng kho chỉ có 2 cái
        int nguongVe0 = 0;

        // Kho có 2 cái (< 5 cái): maxDem = floor(2 / 2) = 1 -> Đệm bị chặn ở mức 1 thay vì 5 -> Số đẩy = 2 - 1 = 1 cái (vẫn có hàng bán)
        int soDay = dongBoService.tinhSoTonDayPhanBo(BigDecimal.valueOf(2), tongKhaDung, tyLe, tonDemTong, nguongVe0);
        assertEquals(1, soDay);

        // Kho có 1 cái: maxDem = floor(1 / 2) = 0 -> Đệm = 0 -> Số đẩy = 1 cái
        int soDay1 = dongBoService.tinhSoTonDayPhanBo(BigDecimal.valueOf(1), tongKhaDung, tyLe, tonDemTong, nguongVe0);
        assertEquals(1, soDay1);
    }

    @Test
    @DisplayName("tinhSoTonDayPhanBo: Tồn <= 0 hoặc dưới ngưỡng về 0 phải trả về 0")
    void testTinhSoTonDayPhanBo_nguongVe0VaTonAm() {
        assertEquals(0, dongBoService.tinhSoTonDayPhanBo(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.valueOf(100), 2, 0));
        assertEquals(0, dongBoService.tinhSoTonDayPhanBo(BigDecimal.valueOf(-5), BigDecimal.ZERO, BigDecimal.valueOf(100), 2, 0));

        // Tồn đẩy tính ra bằng 2 nhưng ngưỡng về 0 là 2 -> Về 0
        int soDayNguong = dongBoService.tinhSoTonDayPhanBo(BigDecimal.valueOf(2), BigDecimal.valueOf(2), BigDecimal.valueOf(100), 0, 2);
        assertEquals(0, soDayNguong);
    }

    @Test
    @DisplayName("layCauHinhKhoMapping: Tự động tắt chế độ đa kho khi sàn chỉ có 1 kho duy nhất")
    void testLayCauHinhKhoMapping_motKhoDuyNhat() {
        KenhBanHang kenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Shopify")
                .trangThai(1)
                .build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));

        // Mock 1 location duy nhất
        ShopifyLocationDto loc1 = ShopifyLocationDto.builder()
                .maKhoSan("gid://shopify/Location/11111")
                .tenKhoSan("Kho Mặc Định")
                .macDinh(true)
                .build();

        Kho khoTong = Kho.builder().id(1).maKho("KT").tenKho("Kho Tổng").trangThai(1).build();
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoTong));

        // Spy method getLocations
        KenhBanHangDongBoServiceImpl spyService = spy(dongBoService);
        doReturn(List.of(loc1)).when(spyService).getLocations("SHOPIFY");

        KenhKhoMappingConfigDto result = spyService.layCauHinhKhoMapping("SHOPIFY");

        assertNotNull(result);
        assertEquals(1, result.getSoKhoSanHopLe());
        assertFalse(result.getCheDoDaKho(), "Khi sàn chỉ có 1 kho, bắt buộc cheDoDaKho = false");
        assertEquals(1, result.getDanhSachKho().size());
        assertEquals("gid://shopify/Location/11111", result.getDanhSachKho().get(0).getMaKhoSan());
    }

    @Test
    @DisplayName("layCauHinhKhoMapping: Tự động kích hoạt khi sàn có từ 2 kho trở lên và loại trừ KHO_TRANSIT")
    void testLayCauHinhKhoMapping_tuHaiKhoTroLenVaLocTransit() {
        KenhBanHang kenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Shopify")
                .trangThai(1)
                .build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));

        ShopifyLocationDto loc1 = ShopifyLocationDto.builder()
                .maKhoSan("gid://shopify/Location/11111")
                .tenKhoSan("Kho Hà Nội")
                .macDinh(true)
                .build();
        ShopifyLocationDto loc2 = ShopifyLocationDto.builder()
                .maKhoSan("gid://shopify/Location/22222")
                .tenKhoSan("Kho TP.HCM")
                .macDinh(false)
                .build();

        Kho khoHN = Kho.builder().id(1).maKho("KHN").tenKho("Kho Hà Nội").trangThai(1).build();
        Kho khoHCM = Kho.builder().id(2).maKho("KHCM").tenKho("Kho Sài Gòn").trangThai(1).build();
        Kho khoTransit = Kho.builder().id(3).maKho("KHO_TRANSIT").tenKho("Kho Trung Chuyển (Transit)").trangThai(1).build();

        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoHN, khoHCM, khoTransit));

        KenhBanHangDongBoServiceImpl spyService = spy(dongBoService);
        doReturn(List.of(loc1, loc2)).when(spyService).getLocations("SHOPIFY");

        KenhKhoMappingConfigDto result = spyService.layCauHinhKhoMapping("SHOPIFY");

        assertNotNull(result);
        assertEquals(2, result.getSoKhoSanHopLe());
        assertTrue(result.getCheDoDaKho(), "Khi sàn có 2 kho trở lên, cheDoDaKho = true");
        assertEquals(2, result.getDanhSachKho().size());

        // Đảm bảo KHO_TRANSIT bị loại trừ khỏi dsKhoFCentricKhaDung
        assertEquals(2, result.getDsKhoFCentricKhaDung().size());
        assertTrue(result.getDsKhoFCentricKhaDung().stream().noneMatch(k -> "KHO_TRANSIT".equalsIgnoreCase(k.getMaKho())));
    }

    @Test
    @DisplayName("luuCauHinhKhoMapping: Tắt đa kho lưu cấu hình thành công không lỗi Hibernate AssertionFailure")
    void testLuuCauHinhKhoMapping_TatDaKho() {
        KenhBanHang kenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Shopify")
                .trangThai(1)
                .build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));

        Kho khoHN = Kho.builder().id(1).maKho("KHN").tenKho("Kho Hà Nội").trangThai(1).build();
        Kho khoHCM = Kho.builder().id(2).maKho("KHCM").tenKho("Kho Sài Gòn").trangThai(1).build();
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoHN, khoHCM));

        java.util.concurrent.atomic.AtomicReference<String> savedJson = new java.util.concurrent.atomic.AtomicReference<>();
        doAnswer(inv -> {
            savedJson.set(inv.getArgument(1));
            return null;
        }).when(dieuHanhHeThongService).setCauHinhString(eq("KENH_SHOPIFY_KHO_MAPPING"), anyString());
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_SHOPIFY_KHO_MAPPING"), any()))
                .thenAnswer(inv -> savedJson.get() != null ? savedJson.get() : inv.getArgument(1));

        KenhBanHangDongBoServiceImpl spyService = spy(dongBoService);
        ShopifyLocationDto loc1 = ShopifyLocationDto.builder().maKhoSan("11111").tenKhoSan("Kho Hà Nội").build();
        ShopifyLocationDto loc2 = ShopifyLocationDto.builder().maKhoSan("22222").tenKhoSan("Kho HCM").build();
        doReturn(List.of(loc1, loc2)).when(spyService).getLocations("SHOPIFY");

        com.dev.backend.dto.channel.warehouse.KenhKhoMappingUpdateRequest req =
                com.dev.backend.dto.channel.warehouse.KenhKhoMappingUpdateRequest.builder()
                        .cheDoDaKho(false)
                        .danhSachKho(List.of(
                                com.dev.backend.dto.channel.warehouse.KenhKhoMappingItemDto.builder()
                                        .maKhoSan("11111")
                                        .tenKhoSan("Kho Hà Nội")
                                        .khoIdFCentric(1)
                                        .laMacDinh(true)
                                        .kichHoat(true)
                                        .build()
                        ))
                        .build();

        KenhKhoMappingConfigDto saved = spyService.luuCauHinhKhoMapping("SHOPIFY", req);
        assertNotNull(saved);
        assertFalse(saved.getCheDoDaKho(), "Sau khi tắt đa kho, cheDoDaKho phải là false");
        verify(dieuHanhHeThongService, atLeastOnce()).setCauHinhString(eq("KENH_SHOPIFY_KHO_MAPPING"), anyString());
    }

    @Test
    @DisplayName("phanBoTonDemWaterfall (PA 1): Tập trung trừ tồn đệm ở kho lớn nhất, tất cả nhỏ hơn 5 rút tuần tự xuống đủ 5")
    void phanBoTonDemWaterfall_PA1_cacKichBanChuan() {
        // Kịch bản 1: Có kho >= tồn đệm (Tổng=20, HN=4, HCM=3), buffer=5 -> Tổng còn 15, HN=4, HCM=3
        var k1 = List.of(
                new KenhBanHangDongBoServiceImpl.KhoTonInput(101L, 1, true, new BigDecimal("20")),
                new KenhBanHangDongBoServiceImpl.KhoTonInput(102L, 2, false, new BigDecimal("4")),
                new KenhBanHangDongBoServiceImpl.KhoTonInput(103L, 3, false, new BigDecimal("3"))
        );
        var out1 = KenhBanHangDongBoServiceImpl.phanBoTonDemWaterfall(k1, new BigDecimal("100"), 5, 0);
        assertEquals(15, out1.get(101L));
        assertEquals(4, out1.get(102L));
        assertEquals(3, out1.get(103L));

        // Kịch bản 2: Tất cả các kho đều < 5 (Tổng=3, HN=4, HCM=2), buffer=5 -> rút HN(4->0), rồi Tổng(3->2), HCM giữ 2
        var k2 = List.of(
                new KenhBanHangDongBoServiceImpl.KhoTonInput(101L, 1, true, new BigDecimal("3")),
                new KenhBanHangDongBoServiceImpl.KhoTonInput(102L, 2, false, new BigDecimal("4")),
                new KenhBanHangDongBoServiceImpl.KhoTonInput(103L, 3, false, new BigDecimal("2"))
        );
        var out2 = KenhBanHangDongBoServiceImpl.phanBoTonDemWaterfall(k2, new BigDecimal("100"), 5, 0);
        assertEquals(2, out2.get(101L));
        assertEquals(0, out2.get(102L));
        assertEquals(2, out2.get(103L));

        // Kịch bản 3: Bằng nhau (HN=10, Tổng=10, HCM=2) -> ưu tiên trừ Kho Tổng trước
        var k3 = List.of(
                new KenhBanHangDongBoServiceImpl.KhoTonInput(102L, 2, false, new BigDecimal("10")),
                new KenhBanHangDongBoServiceImpl.KhoTonInput(101L, 1, true, new BigDecimal("10")),
                new KenhBanHangDongBoServiceImpl.KhoTonInput(103L, 3, false, new BigDecimal("2"))
        );
        var out3 = KenhBanHangDongBoServiceImpl.phanBoTonDemWaterfall(k3, new BigDecimal("100"), 5, 0);
        assertEquals(5, out3.get(101L));
        assertEquals(10, out3.get(102L));
        assertEquals(2, out3.get(103L));

        // Kịch bản 4: Áp dụng tỷ lệ 50% + ngưỡng về 0 = 2 (Tổng=12 sau trừ 5: nếu tính tinhSoTonDay(12, 50, 5, 2) = 1 <= 2 -> về 0; HCM=2 -> 0)
        var k4 = List.of(
                new KenhBanHangDongBoServiceImpl.KhoTonInput(101L, 1, true, new BigDecimal("20")),
                new KenhBanHangDongBoServiceImpl.KhoTonInput(102L, 2, false, new BigDecimal("12")),
                new KenhBanHangDongBoServiceImpl.KhoTonInput(103L, 3, false, new BigDecimal("4"))
        );
        var out4 = KenhBanHangDongBoServiceImpl.phanBoTonDemWaterfall(k4, new BigDecimal("50"), 5, 2);
        assertEquals(5, out4.get(101L));
        assertEquals(6, out4.get(102L));
        assertEquals(0, out4.get(103L));
    }
}
