package com.dev.backend.services.shopify;

import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.services.KenhBanHangService;
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

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class ShopifyStatusSyncTest {

    @Mock
    private KenhBanHangRepository kenhBanHangRepository;

    @Mock
    private KenhBanHangService kenhBanHangService;

    @Mock
    private DonBanHangRepository donBanHangRepository;

    @InjectMocks
    private KenhBanHangDongBoServiceImpl dongBoService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(dongBoService, "objectMapper", objectMapper);
        ReflectionTestUtils.setField(dongBoService, "kenhBanHangRepository", kenhBanHangRepository);
        ReflectionTestUtils.setField(dongBoService, "kenhBanHangService", kenhBanHangService);
        ReflectionTestUtils.setField(dongBoService, "donBanHangRepository", donBanHangRepository);
    }

    @Test
    @DisplayName("dongBoTrangThaiDangThucHienShopify: Bỏ qua khi mã đơn trống hoặc không tìm thấy kênh")
    void testDangThucHien_maDonTrongHoacKhongTimThayKenh() {
        assertFalse(dongBoService.dongBoTrangThaiDangThucHienShopify(null));
        assertFalse(dongBoService.dongBoTrangThaiDangThucHienShopify("   "));

        when(kenhBanHangRepository.findByMaKenh("SHOPEE")).thenReturn(Optional.empty());
        assertFalse(dongBoService.dongBoTrangThaiDangThucHienShopify("12345"));
    }

    @Test
    @DisplayName("dongBoTrangThaiDangThucHienShopify: Bỏ qua an toàn khi chưa cấu hình token hoặc domain")
    void testDangThucHien_chuaCauHinhToken() {
        KenhBanHang kenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .apiUrl("https://fcentric-test.myshopify.com")
                .build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);

        boolean result = dongBoService.dongBoTrangThaiDangThucHienShopify("12345");
        assertFalse(result, "Phải trả về false khi token null");
    }

    @Test
    @DisplayName("dongBoTrangThaiFulfilledShopify: Bỏ qua khi mã đơn trống")
    void testFulfilled_maDonTrong() {
        assertFalse(dongBoService.dongBoTrangThaiFulfilledShopify(1, null));
        assertFalse(dongBoService.dongBoTrangThaiFulfilledShopify(1, ""));
    }

    @Test
    @DisplayName("dongBoTrangThaiDeliveredShopify: Bỏ qua khi mã đơn trống")
    void testDelivered_maDonTrong() {
        assertFalse(dongBoService.dongBoTrangThaiDeliveredShopify(null));
        assertFalse(dongBoService.dongBoTrangThaiDeliveredShopify(""));
    }

    @Test
    @DisplayName("dongBoTrangThaiReturnedShopify: Bỏ qua khi mã đơn trống")
    void testReturned_maDonTrong() {
        assertFalse(dongBoService.dongBoTrangThaiReturnedShopify(null));
        assertFalse(dongBoService.dongBoTrangThaiReturnedShopify(""));
    }

    @Test
    @DisplayName("dongBoHoanTraVaHoanTienShopify: Bỏ qua khi mã đơn trống")
    void testHoanTraVaHoanTien_maDonTrong() {
        assertFalse(dongBoService.dongBoHoanTraVaHoanTienShopify(1, null));
        assertFalse(dongBoService.dongBoHoanTraVaHoanTienShopify(1, "   "));
    }

    @Test
    @DisplayName("dongBoHoanTraVaHoanTienShopify: Bỏ qua an toàn khi chưa cấu hình token")
    void testHoanTraVaHoanTien_chuaCauHinhToken() {
        KenhBanHang kenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .apiUrl("https://fcentric-test.myshopify.com")
                .build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);

        boolean result = dongBoService.dongBoHoanTraVaHoanTienShopify(1, "12345");
        assertFalse(result, "Phải trả về false khi token null");
    }

    @Test
    @DisplayName("KenhBanHangSyncService.pushOrderStatus: Kích hoạt đồng bộ xuất kho cho Shopify, Lazada và TikTok")
    void testPushOrderStatus_kichHoatDongBoCacKenh() {
        com.dev.backend.services.KenhBanHangDongBoService mockDongBoService = mock(com.dev.backend.services.KenhBanHangDongBoService.class);
        com.dev.backend.services.impl.KenhBanHangSyncServiceImpl syncService =
                new com.dev.backend.services.impl.KenhBanHangSyncServiceImpl(donBanHangRepository, kenhBanHangService, mockDongBoService);

        // 1. Kênh Shopify
        KenhBanHang kenhShopify = KenhBanHang.builder().id(1).maKenh("SHOPIFY").tenKenh("Shopify Store").build();
        DonBanHang donShopify = DonBanHang.builder()
                .id(101)
                .soDonHang("DH-SP-001")
                .maDonHangKenh("SHOP-999")
                .kenhBanHang(kenhShopify)
                .build();
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donShopify));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn("shpat_valid_token");
        when(kenhBanHangService.getShopifyApiUrl()).thenReturn("https://fcentric-test.myshopify.com");

        syncService.pushOrderStatus(101, "SHIPPED", "VD-01", "GHTK");
        verify(mockDongBoService, times(1)).dongBoTrangThaiFulfilledShopify(101, "SHOP-999");

        // 2. Kênh Lazada
        KenhBanHang kenhLazada = KenhBanHang.builder().id(2).maKenh("LAZADA").tenKenh("Lazada Mall").build();
        DonBanHang donLazada = DonBanHang.builder()
                .id(102)
                .soDonHang("DH-LZ-002")
                .maDonHangKenh("LAZ-888")
                .kenhBanHang(kenhLazada)
                .build();
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donLazada));
        when(kenhBanHangService.getLazadaAppKey("LAZADA")).thenReturn("app_key_123");
        when(kenhBanHangService.getDecryptedLazadaAccessToken("LAZADA")).thenReturn("laz_valid_token");

        syncService.pushOrderStatus(102, "SHIPPED", "VD-02", "LEX");
        verify(mockDongBoService, times(1)).dongBoTrangThaiReadyToShipLazada("LAZ-888");

        // 3. Kênh TikTok Shop
        KenhBanHang kenhTikTok = KenhBanHang.builder().id(3).maKenh("TIKTOK").tenKenh("TikTok Shop").build();
        DonBanHang donTikTok = DonBanHang.builder()
                .id(103)
                .soDonHang("DH-TT-003")
                .maDonHangKenh("TT-777")
                .kenhBanHang(kenhTikTok)
                .build();
        when(donBanHangRepository.findById(103)).thenReturn(Optional.of(donTikTok));
        when(kenhBanHangService.getTikTokAppKey()).thenReturn("tiktok_key_123");
        when(kenhBanHangService.getDecryptedTikTokAccessToken()).thenReturn("tiktok_valid_token");

        syncService.pushOrderStatus(103, "SHIPPED", "VD-03", "J&T");
        verify(mockDongBoService, times(1)).dongBoTrangThaiReadyToShipTikTok("TT-777");
    }
}

