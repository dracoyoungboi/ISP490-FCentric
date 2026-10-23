package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.customize.ShopifyTestConnectionResponse;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.utils.PaymentSecretCipher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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
    @Mock
    private TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;

    private final PaymentSecretCipher cipher = new PaymentSecretCipher("unit-test-secret");
    private KenhBanHangServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new KenhBanHangServiceImpl(
                kenhBanHangRepository,
                cipher,
                lichSuThayDoiService,
                nguoiDungRepository,
                trangThaiDongBoSanPhamRepository
        );
        when(kenhBanHangRepository.save(any(KenhBanHang.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    /** Các cột khóa đọc thẳng từ CSDL, lấy theo entity giả (đọc lúc gọi, nên phản ánh thay đổi trên entity). */
    private static KenhBanHangRepository.KhoaKenh khoaCua(KenhBanHang k) {
        return new KenhBanHangRepository.KhoaKenh() {
            @Override public Integer getId() { return k.getId(); }
            @Override public String getApiUrl() { return k.getApiUrl(); }
            @Override public String getApiKey() { return k.getApiKey(); }
            @Override public String getApiSecret() { return k.getApiSecret(); }
            @Override public String getClientId() { return k.getClientId(); }
            @Override public String getRefreshToken() { return k.getRefreshToken(); }
            @Override public Instant getTokenExpiresAt() { return k.getTokenExpiresAt(); }
        };
    }

    private KenhBanHang kenhDangKetNoi() {
        return KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Cửa hàng Shopify")
                .loaiKenh("online")
                .apiUrl("https://" + CLEAN_DOMAIN + "/admin/api/2024-01")
                .apiKey(cipher.encrypt(ACCESS_TOKEN))
                .trangThai(1)
                .build();
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
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(savedKenh)));

        ShopifyConfigResponse response = service.updateShopifyConfig(updating);

        assertNotNull(response);
        assertEquals("khoa", response.getKieuKetNoi());
        assertEquals("dang_hoat_dong", response.getTrangThaiKetNoi());
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

        // Chỉ lưu lại công tắc, cùng tên miền, không gửi lại token (đổi tên miền khi đang kết nối bị chặn, xem test riêng)
        ShopifyConfigUpdating updating = ShopifyConfigUpdating.builder()
                .shopDomain("old-domain.myshopify.com")
                .accessToken(null)
                .apiSecret(null)
                .trangThai(0)
                .build();

        service.updateShopifyConfig(updating);

        // Token trong DB vẫn là token cũ đã mã hóa
        assertEquals(encryptedCu, existing.getApiKey());
        assertEquals(ACCESS_TOKEN, cipher.decrypt(existing.getApiKey()));
        assertEquals(0, existing.getTrangThai());
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
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(staticTokenKenh)));

        com.dev.backend.exception.customize.CommonException ex = assertThrows(
                com.dev.backend.exception.customize.CommonException.class,
                () -> service.refreshShopifyAccessToken()
        );

        assertTrue(ex.getMessage().contains("chưa cấu hình Refresh Token"));
    }

    // ---------------- Trạng thái kết nối ----------------

    @Test
    void trangThaiKetNoi_suyTuKhoaDaLuu() {
        Instant bayGio = Instant.parse("2026-10-23T03:00:00Z");
        Instant daQua = bayGio.minusSeconds(60);
        assertEquals("chua_ket_noi", KenhBanHangServiceImpl.trangThaiKetNoi(false, CLEAN_DOMAIN, null, false, false, bayGio));
        assertEquals("chua_ket_noi", KenhBanHangServiceImpl.trangThaiKetNoi(true, "", null, false, false, bayGio));
        // Khóa tĩnh, không có hạn
        assertEquals("dang_hoat_dong", KenhBanHangServiceImpl.trangThaiKetNoi(true, CLEAN_DOMAIN, null, false, false, bayGio));
        // Quá hạn, không có khóa làm mới
        assertEquals("het_han", KenhBanHangServiceImpl.trangThaiKetNoi(true, CLEAN_DOMAIN, daQua, false, false, bayGio));
        // Quá hạn nhưng có khóa làm mới: máy chủ tự làm mới khi dùng
        assertEquals("dang_hoat_dong", KenhBanHangServiceImpl.trangThaiKetNoi(true, CLEAN_DOMAIN, daQua, true, false, bayGio));
        // Shopify đã từ chối khóa làm mới: hết hạn khi khóa truy cập còn dưới 5 phút hoặc đã quá hạn, còn lâu thì chưa
        assertEquals("het_han", KenhBanHangServiceImpl.trangThaiKetNoi(true, CLEAN_DOMAIN, daQua, true, true, bayGio));
        assertEquals("het_han", KenhBanHangServiceImpl.trangThaiKetNoi(true, CLEAN_DOMAIN, bayGio.plusSeconds(60), true, true, bayGio));
        assertEquals("dang_hoat_dong", KenhBanHangServiceImpl.trangThaiKetNoi(true, CLEAN_DOMAIN, bayGio.plusSeconds(3600), true, true, bayGio));
        // Dấu bị từ chối không áp cho khóa tĩnh, cũng không áp khi chưa kết nối
        assertEquals("dang_hoat_dong", KenhBanHangServiceImpl.trangThaiKetNoi(true, CLEAN_DOMAIN, null, false, true, bayGio));
        assertEquals("chua_ket_noi", KenhBanHangServiceImpl.trangThaiKetNoi(false, CLEAN_DOMAIN, daQua, true, true, bayGio));
    }

    @Test
    void getShopifyConfig_coTrangThaiKetNoi() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.empty());
        ShopifyConfigResponse chuaCo = service.getShopifyConfig();
        assertEquals("khoa", chuaCo.getKieuKetNoi());
        assertEquals("chua_ket_noi", chuaCo.getTrangThaiKetNoi());

        KenhBanHang daNgat = kenhDangKetNoi();
        daNgat.setApiKey(null);
        daNgat.setTrangThai(0);
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(daNgat));
        ShopifyConfigResponse sauNgat = service.getShopifyConfig();
        assertEquals("chua_ket_noi", sauNgat.getTrangThaiKetNoi());
        // Tên miền giữ lại để điền sẵn khi kết nối lại
        assertEquals(CLEAN_DOMAIN, sauNgat.getShopDomain());
    }

    @Test
    void getKetNoi_shopifyNhuGetShopify_sanUyQuyenChuaKetNoi_maKhacLoi() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenhDangKetNoi()));
        assertEquals("dang_hoat_dong", service.getKetNoi("shopify").getTrangThaiKetNoi());

        when(kenhBanHangRepository.findByMaKenh("LAZADA")).thenReturn(Optional.of(
                KenhBanHang.builder().id(3).maKenh("LAZADA").tenKenh("Gian hàng Lazada").trangThai(1).build()));
        ShopifyConfigResponse lazada = service.getKetNoi("LAZADA");
        assertEquals("LAZADA", lazada.getMaKenh());
        assertEquals("uy_quyen", lazada.getKieuKetNoi());
        assertEquals("chua_ket_noi", lazada.getTrangThaiKetNoi());
        assertEquals(1, lazada.getTrangThai());

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.getKetNoi("POS"));
        assertEquals(MaLoi.SAN_KHONG_HO_TRO, loi.getMa());
        assertEquals(HttpStatus.BAD_REQUEST, loi.getStatus());
        assertDoesNotThrow(() -> service.kiemTraSanShopify(" Shopify "));
        assertEquals(MaLoi.SAN_KHONG_HO_TRO,
                assertThrows(LoiCoMaException.class, () -> service.kiemTraSanShopify("TIKTOK")).getMa());
    }

    // ---------------- Đổi cửa hàng, kết nối lại ----------------

    @Test
    void updateShopifyConfig_dangKetNoiMaDoiTenMien_bao409KhongLuu() {
        KenhBanHang kenh = kenhDangKetNoi();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.updateShopifyConfig(
                ShopifyConfigUpdating.builder().shopDomain("cua-hang-khac.myshopify.com").accessToken("shpat_moi_1234").build()));

        assertEquals(MaLoi.GIAN_HANG_KHAC, loi.getMa());
        assertEquals(HttpStatus.CONFLICT, loi.getStatus());
        assertTrue(loi.getMessage().contains(CLEAN_DOMAIN));
        assertFalse(loi.getMessage().contains("bị khóa"));
        verify(kenhBanHangRepository, never()).save(any(KenhBanHang.class));
    }

    @Test
    void updateShopifyConfig_cungTenMienKhacHoaThuong_khongCoiLaDoiCuaHang() {
        KenhBanHang kenh = kenhDangKetNoi();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));

        assertDoesNotThrow(() -> service.updateShopifyConfig(
                ShopifyConfigUpdating.builder().shopDomain("HTTPS://FCentric-Fashion.myshopify.com/admin").build()));
        verify(trangThaiDongBoSanPhamRepository, never()).xoaDuLieuCuaHangCu(anyInt());
    }

    @Test
    void updateShopifyConfig_sauKhiNgatKetNoiSangCuaHangKhac_giuLienKetChoGhepLai() {
        KenhBanHang daNgat = kenhDangKetNoi();
        daNgat.setApiKey(null);
        daNgat.setTrangThai(0);
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(daNgat));

        service.updateShopifyConfig(ShopifyConfigUpdating.builder()
                .shopDomain("cua-hang-moi.myshopify.com").accessToken("shpat_cua_hang_moi_9999").build());

        assertEquals("https://cua-hang-moi.myshopify.com/admin/api/2024-01", daNgat.getApiUrl());
        assertEquals("shpat_cua_hang_moi_9999", cipher.decrypt(daNgat.getApiKey()));
        // Kết nối lại thì bật lại đồng bộ (ngắt đã đặt 0)
        assertEquals(1, daNgat.getTrangThai());
        verify(trangThaiDongBoSanPhamRepository).xoaDuLieuCuaHangCu(1);
        verify(trangThaiDongBoSanPhamRepository).danhDauChuaGhep(eq(1), anyString());
    }

    @Test
    void updateShopifyConfig_sauKhiNgatCungCuaHang_khongDungLienKet() {
        KenhBanHang daNgat = kenhDangKetNoi();
        daNgat.setApiKey(null);
        daNgat.setTrangThai(0);
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(daNgat));

        service.updateShopifyConfig(ShopifyConfigUpdating.builder()
                .shopDomain(CLEAN_DOMAIN).accessToken(ACCESS_TOKEN).trangThai(1).build());

        verify(trangThaiDongBoSanPhamRepository, never()).xoaDuLieuCuaHangCu(anyInt());
        verify(trangThaiDongBoSanPhamRepository, never()).danhDauChuaGhep(anyInt(), anyString());
    }

    @Test
    void updateShopifyConfig_kenhDaNgatMaKhongGuiKhoa_bao409KhongLuu() {
        // Tab cũ lưu công tắc "Đồng bộ với gian hàng này" sau khi tab khác đã ngắt kết nối
        KenhBanHang daNgat = kenhDangKetNoi();
        daNgat.setApiKey(null);
        daNgat.setTrangThai(0);
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(daNgat));

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.updateShopifyConfig(
                ShopifyConfigUpdating.builder().shopDomain(CLEAN_DOMAIN).trangThai(1).build()));

        assertEquals(MaLoi.KENH_CHUA_KET_NOI, loi.getMa());
        assertEquals(0, daNgat.getTrangThai());
        verify(kenhBanHangRepository, never()).save(any(KenhBanHang.class));
    }

    @Test
    void lamMoiKhoaShopify_kenhDaNgat_bao409DeGiaoDienDocLaiKetNoi() {
        KenhBanHang daNgat = kenhOAuth();
        daNgat.setApiKey(null);
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(daNgat)));

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.lamMoiKhoaShopify());

        assertEquals(MaLoi.KENH_CHUA_KET_NOI, loi.getMa());
        assertEquals(HttpStatus.CONFLICT, loi.getStatus());
    }

    @Test
    void updateShopifyConfig_khoaTinhMoi_boHanCuDeKhongHetHanMai() {
        KenhBanHang kenh = kenhDangKetNoi();
        kenh.setTokenExpiresAt(Instant.now().minusSeconds(3600));
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));
        assertEquals("het_han", service.getShopifyConfig().getTrangThaiKetNoi());

        ShopifyConfigResponse res = service.updateShopifyConfig(ShopifyConfigUpdating.builder()
                .shopDomain(CLEAN_DOMAIN).accessToken("shpat_khoa_tinh_moi_0000").build());

        assertNull(kenh.getTokenExpiresAt());
        assertEquals("dang_hoat_dong", res.getTrangThaiKetNoi());
    }

    // ---------------- Ngắt kết nối, đọc khóa, làm mới khóa ----------------

    @Test
    void xoaKhoaShopify_xoaKhiDangKetNoi_boQuaKhiDaNgat() {
        KenhBanHang kenh = kenhDangKetNoi();
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));
        service.xoaKhoaShopify();
        verify(kenhBanHangRepository).xoaKhoaVaNgatKetNoi(1);

        KenhBanHang daNgat = kenhDangKetNoi();
        daNgat.setId(2);
        daNgat.setApiKey(null);
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(daNgat)));
        service.xoaKhoaShopify();
        verify(kenhBanHangRepository, never()).xoaKhoaVaNgatKetNoi(2);
    }

    @Test
    void getDecryptedShopifyAccessToken_docCotMoiNhat_khongDungEntityCu() {
        // Entity trong phiên còn khóa, nhưng CSDL đã ngắt: phải trả null
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenhDangKetNoi()));
        KenhBanHang daNgat = kenhDangKetNoi();
        daNgat.setApiKey(null);
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(daNgat)));

        assertNull(service.getDecryptedShopifyAccessToken());
    }

    private KenhBanHang kenhOAuth() {
        KenhBanHang kenh = kenhDangKetNoi();
        kenh.setRefreshToken(cipher.encrypt("shprt_khoa_lam_moi_cu_1111"));
        kenh.setClientId("client-1");
        kenh.setTokenExpiresAt(Instant.now().plusSeconds(60));
        return kenh;
    }

    @Test
    void lamMoiKhoa_kenhVuaNgatTrongLucChoShopify_khongGhiKhoaTroLai() throws Exception {
        KenhBanHang kenh = kenhOAuth();
        String refreshCu = kenh.getRefreshToken();
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));
        KenhBanHangServiceImpl spyService = spy(service);
        doReturn(new ObjectMapper().readTree("{\"access_token\":\"shpat_moi_2222\",\"refresh_token\":\"shprt_moi_3333\",\"expires_in\":3600}"))
                .when(spyService).xinKhoaMoiTuShopify(anyString(), any());
        // Câu UPDATE có điều kiện không khớp dòng nào: khóa làm mới trong CSDL đã bị ngắt kết nối xóa
        when(kenhBanHangRepository.ghiKhoaSauLamMoi(eq(1), anyString(), anyString(), any(), eq(refreshCu))).thenReturn(0);

        assertFalse(spyService.refreshShopifyAccessToken());
        verify(kenhBanHangRepository).ghiKhoaSauLamMoi(eq(1), anyString(), anyString(), any(), eq(refreshCu));
        verify(kenhBanHangRepository, never()).save(any(KenhBanHang.class));

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, spyService::lamMoiKhoaShopify);
        assertEquals(MaLoi.LAM_MOI_KHOA_LOI, loi.getMa());
        assertEquals(HttpStatus.FAILED_DEPENDENCY, loi.getStatus());
    }

    @Test
    void lamMoiKhoa_thanhCong_ghiCoDieuKienTheoKhoaLamMoiCu() throws Exception {
        KenhBanHang kenh = kenhOAuth();
        String refreshCu = kenh.getRefreshToken();
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));
        KenhBanHangServiceImpl spyService = spy(service);
        doReturn(new ObjectMapper().readTree("{\"access_token\":\"shpat_moi_2222\",\"expires_in\":3600}"))
                .when(spyService).xinKhoaMoiTuShopify(anyString(), any());
        when(kenhBanHangRepository.ghiKhoaSauLamMoi(eq(1), anyString(), anyString(), any(), eq(refreshCu))).thenReturn(1);

        assertNotNull(spyService.lamMoiKhoaShopify());
        // Shopify không trả khóa làm mới mới thì giữ khóa làm mới cũ
        verify(kenhBanHangRepository).ghiKhoaSauLamMoi(eq(1), anyString(), eq(refreshCu), any(), eq(refreshCu));
    }

    @Test
    void lamMoiKhoa_shopifyTuChoi_bao424KhongPhai401KhongPhai502() throws Exception {
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenhOAuth())));
        KenhBanHangServiceImpl spyService = spy(service);
        doThrow(HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, "Unauthorized",
                new org.springframework.http.HttpHeaders(), new byte[0], null))
                .when(spyService).xinKhoaMoiTuShopify(anyString(), any());

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, spyService::lamMoiKhoaShopify);
        // Không 401 (giao diện đăng xuất), không 502 (Cloudflare thay trang lỗi, mất mã và câu báo)
        assertEquals(HttpStatus.FAILED_DEPENDENCY, loi.getStatus());
        assertEquals(MaLoi.LAM_MOI_KHOA_LOI, loi.getMa());
        assertFalse(loi.getMessage().contains("bị khóa"));
    }

    @Test
    void coKhoaShopify_docCotKhongGiaiMa() {
        KenhBanHang kenh = kenhDangKetNoi();
        // Khóa lưu sai định dạng (không giải mã được) vẫn tính là có khóa: ngắt kết nối phải làm được
        kenh.setApiKey("v1:khong-giai-ma-duoc");
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));
        assertTrue(service.coKhoaShopify());

        kenh.setApiKey(null);
        assertFalse(service.coKhoaShopify());
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.empty());
        assertFalse(service.coKhoaShopify());
    }

    @Test
    void getShopifyConfig_khoaKhongGiaiMaDuoc_vanMoDuocTrangDeNgatKetNoi() {
        KenhBanHang kenh = kenhOAuth();
        // Đổi khóa mã hóa của máy chủ: khóa đã lưu không giải mã được
        kenh.setApiKey("v1:khong-giai-ma-duoc");
        kenh.setRefreshToken("v1:khong-giai-ma-duoc");
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));

        ShopifyConfigResponse cfg = assertDoesNotThrow(service::getShopifyConfig);
        assertTrue(cfg.isHasAccessToken());
        assertNull(cfg.getAccessTokenMasked());
        assertNull(cfg.getRefreshTokenMasked());
        assertEquals("dang_hoat_dong", cfg.getTrangThaiKetNoi());
    }

    @Test
    void lamMoiKhoa_tabKhacNgatTrongLucChoShopify_baoChuaKetNoiKhongPhai424() throws Exception {
        KenhBanHang kenh = kenhOAuth();
        String refreshCu = kenh.getRefreshToken();
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));
        KenhBanHangServiceImpl spyService = spy(service);
        // Trong lúc chờ Shopify, tab khác ngắt kết nối: cột khóa bị xóa, câu UPDATE có điều kiện không khớp dòng nào
        org.mockito.Mockito.doAnswer(inv -> {
            kenh.setApiKey(null);
            kenh.setRefreshToken(null);
            return new ObjectMapper().readTree("{\"access_token\":\"shpat_moi_2222\",\"expires_in\":3600}");
        }).when(spyService).xinKhoaMoiTuShopify(anyString(), any());
        when(kenhBanHangRepository.ghiKhoaSauLamMoi(eq(1), anyString(), anyString(), any(), eq(refreshCu))).thenReturn(0);

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, spyService::lamMoiKhoaShopify);
        assertEquals(MaLoi.KENH_CHUA_KET_NOI, loi.getMa());
        assertEquals(HttpStatus.CONFLICT, loi.getStatus());
    }

    @Test
    void lamMoiKhoa_tabKhacNgatTruocKhiGiuKhoa_baoChuaKetNoiKhongPhaiKhoaTinh() {
        KenhBanHang daNgat = kenhDangKetNoi();
        daNgat.setApiKey(null);
        // Lần đọc đầu (kiểm có khóa) còn khóa; tới lúc giữ khóa làm mới thì tab khác đã xóa hết
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY"))
                .thenReturn(Optional.of(khoaCua(kenhOAuth())), Optional.of(khoaCua(daNgat)));

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, service::lamMoiKhoaShopify);
        assertEquals(MaLoi.KENH_CHUA_KET_NOI, loi.getMa());
    }

    @Test
    void xoaKhoaShopify_ghiLichSuCoNguoiBamVaTenMien_khongCoKhoa() {
        com.dev.backend.dto.response.entities.NguoiDungAuthInfo nguoi = new com.dev.backend.dto.response.entities.NguoiDungAuthInfo();
        nguoi.setId(7);
        com.dev.backend.config.SecurityContextHolder.setUser(nguoi);
        try {
            when(nguoiDungRepository.findById(7)).thenReturn(Optional.of(com.dev.backend.entities.NguoiDung.builder().id(7).build()));
            KenhBanHang kenh = kenhDangKetNoi();
            when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));

            service.xoaKhoaShopify();

            org.mockito.ArgumentCaptor<com.dev.backend.entities.LichSuThayDoi> captor =
                    org.mockito.ArgumentCaptor.forClass(com.dev.backend.entities.LichSuThayDoi.class);
            verify(lichSuThayDoiService).create(captor.capture());
            assertEquals("Ngắt kết nối Shopify: " + CLEAN_DOMAIN, captor.getValue().getGiaTriMoi());
            assertEquals(7, captor.getValue().getNguoiThucHien().getId());
            assertFalse(captor.getValue().getGiaTriMoi().contains("shpat_"));
            assertFalse(String.valueOf(captor.getValue().getGhiChu()).contains("shpat_"));
        } finally {
            com.dev.backend.config.SecurityContextHolder.clear();
        }
    }

    @Test
    void updateShopifyConfig_ketNoiLaiCoGuiTrangThai0_giuTamDung() {
        KenhBanHang daNgat = kenhDangKetNoi();
        daNgat.setApiKey(null);
        daNgat.setTrangThai(0);
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(daNgat));

        service.updateShopifyConfig(ShopifyConfigUpdating.builder()
                .shopDomain(CLEAN_DOMAIN).accessToken(ACCESS_TOKEN).trangThai(0).build());

        assertEquals(0, daNgat.getTrangThai());
        assertEquals(ACCESS_TOKEN, cipher.decrypt(daNgat.getApiKey()));
    }

    // ---------- M-5: "kiểm tra kết nối" không thành công cụ gửi khóa / dò mạng nội bộ ----------

    @Test
    void testShopifyConnection_tenMienNgoaiMyshopify_tuChoiKhongGoiRaNgoai() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenhDangKetNoi()));

        for (String mien : new String[]{"127.0.0.1:8080", "169.254.169.254", "localhost", "minio:9000",
                "attacker.example", "x.myshopify.com.attacker.example", "a@b.myshopify.com", "x.myshopify.com:22",
                "x.myshopify.com.", "-x.myshopify.com", "x y.myshopify.com", "x.myshopify.com%2e", "x\n.myshopify.com"}) {
            ShopifyTestConnectionResponse res = service.testShopifyConnection(ShopifyTestConnectionRequest.builder()
                    .shopDomain(mien).accessToken(null).build());
            assertFalse(res.isConnected(), mien);
            assertEquals(KenhBanHangServiceImpl.LOI_MIEN_SHOPIFY, res.getMessage(), mien);
        }
        // Khóa đã lưu không hề được giải mã
        verify(kenhBanHangRepository, never()).docKhoaTheoMaKenh(anyString());
    }

    @Test
    void testShopifyConnection_cuaHangKhacKhongNhapKhoa_khongGuiKhoaDaLuu() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenhDangKetNoi()));

        ShopifyTestConnectionResponse res = service.testShopifyConnection(ShopifyTestConnectionRequest.builder()
                .shopDomain("cua-hang-la.myshopify.com").accessToken("  ").build());

        assertFalse(res.isConnected());
        assertEquals("Nhập khóa truy cập của cửa hàng cua-hang-la.myshopify.com để kiểm tra kết nối", res.getMessage());
        verify(kenhBanHangRepository, never()).docKhoaTheoMaKenh(anyString());
    }

    @Test
    void updateShopifyConfig_tenMienMoiKhongDungDang_bao400KhongLuu() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.empty());

        com.dev.backend.exception.customize.CommonException loi = assertThrows(
                com.dev.backend.exception.customize.CommonException.class,
                () -> service.updateShopifyConfig(ShopifyConfigUpdating.builder()
                        .shopDomain("http://10.0.0.5:8080/").accessToken(ACCESS_TOKEN).build()));

        assertEquals(KenhBanHangServiceImpl.LOI_MIEN_SHOPIFY, loi.getMessage());
        verify(kenhBanHangRepository, never()).save(any(KenhBanHang.class));
    }

    @Test
    void updateShopifyConfig_tenMienRiengDangLuu_vanLuuLaiDuoc() {
        // Gian hàng cũ lưu tên miền riêng (giao diện cũng không bắt dạng *.myshopify.com với tên miền đang giữ)
        KenhBanHang kenh = kenhDangKetNoi();
        kenh.setApiUrl("https://shop.fcentric.vn/admin/api/2024-01");
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));

        assertDoesNotThrow(() -> service.updateShopifyConfig(ShopifyConfigUpdating.builder()
                .shopDomain("shop.fcentric.vn").trangThai(0).build()));
        assertEquals(0, kenh.getTrangThai());
    }

    @Test
    void updateShopifyConfig_tenMienViet_hoaVaCoGiaoThuc_vanDungDang() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.empty());

        // Chuẩn hóa chữ thường theo Locale.ROOT, bỏ giao thức và đường dẫn rồi mới so dạng *.myshopify.com
        assertDoesNotThrow(() -> service.updateShopifyConfig(ShopifyConfigUpdating.builder()
                .shopDomain("  HTTPS://Cua-Hang-MOI.MyShopify.com/admin ").accessToken(ACCESS_TOKEN).build()));
    }

    // ---------- Shopify từ chối khóa làm mới (đề xuất "Khóa làm mới Shopify bị từ chối") ----------

    private static final String KHOA_MOI_JSON = "{\"access_token\":\"shpat_moi_2222\",\"refresh_token\":\"shprt_moi_3333\",\"expires_in\":3600}";

    private KenhBanHangServiceImpl dichVuMoi() {
        return new KenhBanHangServiceImpl(kenhBanHangRepository, cipher, lichSuThayDoiService, nguoiDungRepository,
                trangThaiDongBoSanPhamRepository);
    }

    private static HttpClientErrorException shopifyTraLoi(HttpStatus status) {
        return HttpClientErrorException.create(status, status.getReasonPhrase(), new org.springframework.http.HttpHeaders(),
                new byte[0], null);
    }

    /** Kênh OAuth tới lúc làm mới, Shopify trả 401; trả dịch vụ đã spy (chưa gọi gì). */
    private KenhBanHangServiceImpl shopifyTuChoi(KenhBanHang kenh) throws Exception {
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));
        KenhBanHangServiceImpl spyService = spy(dichVuMoi());
        doThrow(shopifyTraLoi(HttpStatus.UNAUTHORIZED)).when(spyService).xinKhoaMoiTuShopify(anyString(), any());
        return spyService;
    }

    @Test
    void tuChoiLamMoi_401_hetHanKhoa_lanSauKhongGoiLaiShopify() throws Exception {
        // Khóa truy cập còn 60 giây: tới lúc tự làm mới
        KenhBanHangServiceImpl spyService = shopifyTuChoi(kenhOAuth());

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, spyService::getDecryptedShopifyAccessToken);
        assertEquals(MaLoi.LAM_MOI_KHOA_LOI, loi.getMa());
        assertEquals(HttpStatus.FAILED_DEPENDENCY, loi.getStatus());
        assertTrue(loi.getMessage().contains("HTTP 401"));
        assertFalse(loi.getMessage().contains("bị khóa"));
        assertEquals("het_han", spyService.getShopifyConfig().getTrangThaiKetNoi());

        // Lần sau không gọi lại Shopify; khóa truy cập chưa quá hạn thì vẫn dùng được tới hết hạn
        assertEquals(ACCESS_TOKEN, spyService.getDecryptedShopifyAccessToken());
        verify(spyService, times(1)).xinKhoaMoiTuShopify(anyString(), any());
    }

    @Test
    void tuChoiLamMoi_khoaTruyCapDaQuaHan_bao424NgayKhongGoiShopify() throws Exception {
        KenhBanHang kenh = kenhOAuth();
        kenh.setTokenExpiresAt(Instant.now().minusSeconds(60));
        KenhBanHangServiceImpl spyService = shopifyTuChoi(kenh);

        assertThrows(LoiCoMaException.class, spyService::getDecryptedShopifyAccessToken);
        LoiCoMaException lanSau = assertThrows(LoiCoMaException.class, spyService::getDecryptedShopifyAccessToken);
        assertEquals(MaLoi.LAM_MOI_KHOA_LOI, lanSau.getMa());
        assertTrue(lanSau.getMessage().contains("Cập nhật khóa truy cập"));
        verify(spyService, times(1)).xinKhoaMoiTuShopify(anyString(), any());
    }

    @Test
    void tuChoiLamMoi_maKhac_khongGhiDau_lanSauVanThuLai() throws Exception {
        for (Exception loiShopify : java.util.List.of(
                shopifyTraLoi(HttpStatus.PAYMENT_REQUIRED),
                shopifyTraLoi(HttpStatus.LOCKED),
                shopifyTraLoi(HttpStatus.TOO_MANY_REQUESTS),
                org.springframework.web.client.HttpServerErrorException.create(HttpStatus.SERVICE_UNAVAILABLE,
                        "Service Unavailable", new org.springframework.http.HttpHeaders(), new byte[0], null),
                new org.springframework.web.client.ResourceAccessException("Hết giờ chờ Shopify"))) {
            KenhBanHang kenh = kenhOAuth();
            when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));
            when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));
            KenhBanHangServiceImpl spyService = spy(dichVuMoi());
            doThrow(loiShopify).when(spyService).xinKhoaMoiTuShopify(anyString(), any());

            for (int lan = 0; lan < 2; lan++) {
                try {
                    spyService.getDecryptedShopifyAccessToken();
                } catch (LoiCoMaException e) {
                    // 402, 423, 429: vẫn 424 nhưng không phải câu "đã từ chối"
                    assertFalse(e.getMessage().contains("đã từ chối"), e.getMessage());
                }
            }
            verify(spyService, times(2)).xinKhoaMoiTuShopify(anyString(), any());
            assertEquals("dang_hoat_dong", spyService.getShopifyConfig().getTrangThaiKetNoi(), loiShopify.getMessage());
        }
    }

    @Test
    void tuChoiLamMoi_mayKhacVuaLamMoi_khongGhiDauDungKhoaMoi() throws Exception {
        KenhBanHang kenh = kenhOAuth();
        when(kenhBanHangRepository.docKhoaTheoMaKenh("SHOPIFY")).thenReturn(Optional.of(khoaCua(kenh)));
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kenh));
        KenhBanHangServiceImpl spyService = spy(dichVuMoi());
        // Trong lúc chờ Shopify, máy khác dùng chung CSDL đã làm mới xong: khóa làm mới cũ bị Shopify từ chối
        doAnswer(inv -> {
            kenh.setApiKey(cipher.encrypt("shpat_may_khac_4444"));
            kenh.setRefreshToken(cipher.encrypt("shprt_may_khac_5555"));
            kenh.setTokenExpiresAt(Instant.now().plusSeconds(3600));
            throw shopifyTraLoi(HttpStatus.UNAUTHORIZED);
        }).when(spyService).xinKhoaMoiTuShopify(anyString(), any());

        assertEquals("shpat_may_khac_4444", spyService.getDecryptedShopifyAccessToken());
        assertEquals("dang_hoat_dong", spyService.getShopifyConfig().getTrangThaiKetNoi());
    }

    @Test
    void tuChoiLamMoi_chiGatCongTacGiuDau_luuKhoaThiHetDau() throws Exception {
        KenhBanHang kenh = kenhOAuth();
        KenhBanHangServiceImpl spyService = shopifyTuChoi(kenh);
        assertThrows(LoiCoMaException.class, spyService::getDecryptedShopifyAccessToken);

        // Công tắc "Đồng bộ với gian hàng này" chỉ gửi tên miền và trạng thái: bộ khóa không đổi
        spyService.updateShopifyConfig(ShopifyConfigUpdating.builder().shopDomain(CLEAN_DOMAIN).trangThai(0).build());
        assertEquals("het_han", spyService.getShopifyConfig().getTrangThaiKetNoi());

        // Lưu lại client secret, kể cả giá trị cũ: chuỗi mã hóa đổi, dấu hết hiệu lực, lần đọc sau thử làm mới lại
        spyService.updateShopifyConfig(ShopifyConfigUpdating.builder().shopDomain(CLEAN_DOMAIN).apiSecret(API_SECRET).build());
        assertEquals("dang_hoat_dong", spyService.getShopifyConfig().getTrangThaiKetNoi());
        assertThrows(LoiCoMaException.class, spyService::getDecryptedShopifyAccessToken);
        verify(spyService, times(2)).xinKhoaMoiTuShopify(anyString(), any());
    }

    @Test
    void tuChoiLamMoi_capLaiKhoaVanGoiShopify_thanhCongThiHetDau() throws Exception {
        KenhBanHang kenh = kenhOAuth();
        String refreshCu = kenh.getRefreshToken();
        KenhBanHangServiceImpl spyService = shopifyTuChoi(kenh);
        assertThrows(LoiCoMaException.class, spyService::getDecryptedShopifyAccessToken);

        doReturn(new ObjectMapper().readTree(KHOA_MOI_JSON)).when(spyService).xinKhoaMoiTuShopify(anyString(), any());
        when(kenhBanHangRepository.ghiKhoaSauLamMoi(eq(1), anyString(), anyString(), any(), eq(refreshCu))).thenReturn(1);

        assertEquals("dang_hoat_dong", spyService.lamMoiKhoaShopify().getTrangThaiKetNoi());
        verify(spyService, times(2)).xinKhoaMoiTuShopify(anyString(), any());
    }

    @Test
    void luuKhoaTruyCapMoi_khoaLamMoiBiTuChoi_boKhoaLamMoiThanhKhoaTinh() throws Exception {
        KenhBanHang kenh = kenhOAuth();
        KenhBanHangServiceImpl spyService = shopifyTuChoi(kenh);
        assertThrows(LoiCoMaException.class, spyService::getDecryptedShopifyAccessToken);

        // Giao diện luôn gửi Client ID, để trống khóa làm mới
        spyService.updateShopifyConfig(ShopifyConfigUpdating.builder()
                .shopDomain(CLEAN_DOMAIN).accessToken("shpat_tinh_moi_6666").clientId("client-1").build());

        assertNull(kenh.getRefreshToken());
        assertNull(kenh.getTokenExpiresAt());
        ShopifyConfigResponse cfg = spyService.getShopifyConfig();
        assertEquals("dang_hoat_dong", cfg.getTrangThaiKetNoi());
        assertFalse(cfg.isHasRefreshToken());
        // Lần đọc khóa sau dùng khóa vừa dán, không làm mới nữa
        assertEquals("shpat_tinh_moi_6666", spyService.getDecryptedShopifyAccessToken());
        verify(spyService, times(1)).xinKhoaMoiTuShopify(anyString(), any());
    }

    @Test
    void luuKhoaTruyCapMoi_khoaQuaHanChuaBiTuChoiCungBo_conHanThiGiu() {
        ShopifyConfigUpdating chiKhoaTruyCap = ShopifyConfigUpdating.builder()
                .shopDomain(CLEAN_DOMAIN).accessToken("shpat_tinh_moi_6666").clientId("client-1").build();

        // Quá hạn mà chưa bị từ chối (vd. dấu mất do khởi động lại): vẫn bỏ, kẻo lần đọc sau làm mới đè mất khóa vừa dán
        KenhBanHang quaHan = kenhOAuth();
        quaHan.setTokenExpiresAt(Instant.now().minusSeconds(60));
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(quaHan));
        service.updateShopifyConfig(chiKhoaTruyCap);
        assertNull(quaHan.getRefreshToken());
        assertNull(quaHan.getTokenExpiresAt());

        // Còn hạn, chưa bị từ chối: giữ khóa làm mới và hạn như cũ
        KenhBanHang conHan = kenhOAuth();
        conHan.setTokenExpiresAt(Instant.now().plusSeconds(3600));
        String refreshCu = conHan.getRefreshToken();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(conHan));
        service.updateShopifyConfig(chiKhoaTruyCap);
        assertEquals(refreshCu, conHan.getRefreshToken());
        assertNotNull(conHan.getTokenExpiresAt());

        // Gửi kèm khóa làm mới mới thì dùng khóa đó
        KenhBanHang kemKhoaLamMoi = kenhOAuth();
        kemKhoaLamMoi.setTokenExpiresAt(Instant.now().minusSeconds(60));
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(kemKhoaLamMoi));
        service.updateShopifyConfig(ShopifyConfigUpdating.builder().shopDomain(CLEAN_DOMAIN)
                .accessToken("shpat_tinh_moi_6666").refreshToken("shprt_moi_7777").build());
        assertEquals("shprt_moi_7777", cipher.decrypt(kemKhoaLamMoi.getRefreshToken()));
    }
}

