package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.customize.ShopifyTestConnectionResponse;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.utils.PaymentSecretCipher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KenhBanHangServiceTest {

    private static final String STORE_DOMAIN = "https://fcentric-fashion.myshopify.com/";
    private static final String CLEAN_DOMAIN = "fcentric-fashion.myshopify.com";
    private static final String ACCESS_TOKEN = "shpat_9876543210fedcba";
    private static final String API_SECRET = "shpss_secret_abcdef123";

    @Mock
    private KenhBanHangRepository kenhBanHangRepository;
    @Mock
    private LichSuThayDoiService lichSuThayDoiService;
    @Mock
    private NguoiDungRepository nguoiDungRepository;

    private final PaymentSecretCipher cipher = new PaymentSecretCipher("unit-test-secret");
    private KenhBanHangServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new KenhBanHangServiceImpl(
                kenhBanHangRepository,
                cipher,
                lichSuThayDoiService,
                nguoiDungRepository
        );
        when(kenhBanHangRepository.save(any(KenhBanHang.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void getShopifyConfig_khiChuaCauHinh_traVeMacDinh() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.empty());

        ShopifyConfigResponse response = service.getShopifyConfig();

        assertNotNull(response);
        assertEquals("SHOPIFY", response.getMaKenh());
        assertFalse(response.isHasAccessToken());
        assertFalse(response.isHasApiSecret());
        assertNull(response.getAccessTokenMasked());
        assertEquals(0, response.getTrangThai());
    }

    @Test
    void updateShopifyConfig_voiCredentialMoi_maHoaVaLuuChuan() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.empty());

        ShopifyConfigUpdating updating = ShopifyConfigUpdating.builder()
                .shopDomain(STORE_DOMAIN)
                .accessToken(ACCESS_TOKEN)
                .apiSecret(API_SECRET)
                .trangThai(1)
                .build();

        // Giả lập sau khi save thì findByMaKenh trả về entity đã lưu
        KenhBanHang savedKenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Cửa hàng Shopify")
                .loaiKenh("online")
                .apiUrl("https://" + CLEAN_DOMAIN + "/admin/api/2024-01")
                .apiKey(cipher.encrypt(ACCESS_TOKEN))
                .apiSecret(cipher.encrypt(API_SECRET))
                .trangThai(1)
                .build();

        when(kenhBanHangRepository.save(any(KenhBanHang.class))).thenReturn(savedKenh);
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(savedKenh));

        ShopifyConfigResponse response = service.updateShopifyConfig(updating);

        assertNotNull(response);
        assertEquals(CLEAN_DOMAIN, response.getShopDomain());
        assertTrue(response.isHasAccessToken());
        assertTrue(response.isHasApiSecret());
        assertTrue(response.getAccessTokenMasked().startsWith("shpat_"));
        assertTrue(response.getAccessTokenMasked().endsWith("dcba"));
        assertFalse(response.getAccessTokenMasked().contains("9876543210")); // Đã bị mask

        // Xác minh giải mã ra đúng token ban đầu
        String decrypted = service.getDecryptedShopifyAccessToken();
        assertEquals(ACCESS_TOKEN, decrypted);
    }

    @Test
    void updateShopifyConfig_khiKhongNhapLaiToken_giuNguyenTokenCu() {
        String encryptedCu = cipher.encrypt(ACCESS_TOKEN);
        KenhBanHang existing = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Cửa hàng Shopify")
                .loaiKenh("online")
                .apiUrl("https://old-domain.myshopify.com/admin/api/2024-01")
                .apiKey(encryptedCu)
                .apiSecret(cipher.encrypt(API_SECRET))
                .trangThai(1)
                .build();

        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(existing));

        // Chỉ cập nhật domain, không gửi lại token
        ShopifyConfigUpdating updating = ShopifyConfigUpdating.builder()
                .shopDomain("new-store.myshopify.com")
                .accessToken(null)
                .apiSecret(null)
                .trangThai(1)
                .build();

        service.updateShopifyConfig(updating);

        // Token trong DB vẫn là token cũ đã mã hóa
        assertEquals(encryptedCu, existing.getApiKey());
        assertEquals(ACCESS_TOKEN, cipher.decrypt(existing.getApiKey()));
    }

    @Test
    void testShopifyConnection_khiKhongCoToken_traVeThatBai() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.empty());

        ShopifyTestConnectionRequest request = ShopifyTestConnectionRequest.builder()
                .shopDomain(CLEAN_DOMAIN)
                .accessToken(null)
                .build();

        ShopifyTestConnectionResponse res = service.testShopifyConnection(request);

        assertNotNull(res);
        assertFalse(res.isConnected());
        assertTrue(res.getMessage().contains("Chưa có Admin Access Token"));
    }

    @Test
    void updateShopifyConfig_voiOAuth2Credentials_luuRefreshTokenVaExpiry() {
        String clientId = "shopify_app_client_id_123";
        String refreshToken = "shprt_refresh_token_99998888";
        java.time.Instant expiry = java.time.Instant.now().plusSeconds(3600);

        ShopifyConfigUpdating updating = ShopifyConfigUpdating.builder()
                .shopDomain(STORE_DOMAIN)
                .accessToken(ACCESS_TOKEN)
                .apiSecret(API_SECRET)
                .clientId(clientId)
                .refreshToken(refreshToken)
                .tokenExpiresAt(expiry)
                .trangThai(1)
                .build();

        KenhBanHang savedKenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Cửa hàng Shopify")
                .loaiKenh("online")
                .apiUrl("https://" + CLEAN_DOMAIN + "/admin/api/2024-01")
                .apiKey(cipher.encrypt(ACCESS_TOKEN))
                .apiSecret(cipher.encrypt(API_SECRET))
                .clientId(clientId)
                .refreshToken(cipher.encrypt(refreshToken))
                .tokenExpiresAt(expiry)
                .trangThai(1)
                .build();

        when(kenhBanHangRepository.save(any(KenhBanHang.class))).thenReturn(savedKenh);
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(savedKenh));

        ShopifyConfigResponse response = service.updateShopifyConfig(updating);

        assertNotNull(response);
        assertEquals(clientId, response.getClientId());
        assertTrue(response.isHasRefreshToken());
        assertNotNull(response.getRefreshTokenMasked());
        assertTrue(response.getRefreshTokenMasked().startsWith("shprt_"));
        assertTrue(response.getRefreshTokenMasked().endsWith("8888"));
        assertFalse(response.isTokenExpired());
        assertNotNull(response.getSecondsUntilExpiration());
        assertTrue(response.getSecondsUntilExpiration() > 3000);
    }

    @Test
    void refreshShopifyAccessToken_khiChuaCoRefreshToken_nemNgoaiLeHopLe() {
        KenhBanHang staticTokenKenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .apiUrl("https://" + CLEAN_DOMAIN + "/admin/api/2024-01")
                .apiKey(cipher.encrypt(ACCESS_TOKEN))
                .refreshToken(null) // Static Custom App token, không có refresh token
                .build();

        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(staticTokenKenh));

        com.dev.backend.exception.customize.CommonException ex = assertThrows(
                com.dev.backend.exception.customize.CommonException.class,
                () -> service.refreshShopifyAccessToken()
        );

        assertTrue(ex.getMessage().contains("chưa cấu hình Refresh Token"));
    }
}

