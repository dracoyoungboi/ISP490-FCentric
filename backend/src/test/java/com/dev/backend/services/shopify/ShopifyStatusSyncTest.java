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
}

