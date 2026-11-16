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
}
