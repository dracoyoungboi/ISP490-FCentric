package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.customize.ShopifyTestConnectionResponse;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.utils.PaymentSecretCipher;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;

@Service
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhBanHangServiceImpl implements KenhBanHangService {

    public static final String MA_KENH_SHOPIFY = "SHOPIFY";
    public static final String DEFAULT_API_VERSION = "2024-01";

    KenhBanHangRepository kenhBanHangRepository;
    PaymentSecretCipher paymentSecretCipher;
    LichSuThayDoiService lichSuThayDoiService;
    NguoiDungRepository nguoiDungRepository;
    ObjectMapper objectMapper = new ObjectMapper();
    java.util.concurrent.locks.ReentrantLock tokenRefreshLock = new java.util.concurrent.locks.ReentrantLock();

    @Override
    @Transactional(readOnly = true)
    public ShopifyConfigResponse getShopifyConfig() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
        if (kenh == null) {
            return ShopifyConfigResponse.builder()
                    .maKenh(MA_KENH_SHOPIFY)
                    .tenKenh("Cửa hàng Shopify")
                    .loaiKenh("online")
                    .shopDomain("")
                    .apiUrl("")
                    .accessTokenMasked(null)
                    .hasAccessToken(false)
                    .hasApiSecret(false)
                    .clientId(null)
                    .hasRefreshToken(false)
                    .refreshTokenMasked(null)
                    .tokenExpiresAt(null)
                    .isTokenExpired(false)
                    .secondsUntilExpiration(null)
                    .trangThai(0)
                    .build();
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        boolean hasToken = kenh.getApiKey() != null && !kenh.getApiKey().isBlank();
        boolean hasSecret = kenh.getApiSecret() != null && !kenh.getApiSecret().isBlank();
        String masked = hasToken ? maskToken(paymentSecretCipher.decrypt(kenh.getApiKey())) : null;

        boolean hasRefresh = kenh.getRefreshToken() != null && !kenh.getRefreshToken().isBlank();
        String maskedRefresh = hasRefresh ? maskRefreshToken(paymentSecretCipher.decrypt(kenh.getRefreshToken())) : null;
        boolean isExpired = false;
        Long secondsUntilExpiration = null;
        if (kenh.getTokenExpiresAt() != null) {
            Instant now = Instant.now();
            isExpired = now.isAfter(kenh.getTokenExpiresAt());
            secondsUntilExpiration = java.time.Duration.between(now, kenh.getTokenExpiresAt()).getSeconds();
        }

        return ShopifyConfigResponse.builder()
                .id(kenh.getId())
                .maKenh(kenh.getMaKenh())
                .tenKenh(kenh.getTenKenh())
                .loaiKenh(kenh.getLoaiKenh())
                .shopDomain(domain)
                .apiUrl(kenh.getApiUrl())
                .accessTokenMasked(masked)
                .hasAccessToken(hasToken)
                .hasApiSecret(hasSecret)
                .clientId(kenh.getClientId())
                .hasRefreshToken(hasRefresh)
                .refreshTokenMasked(maskedRefresh)
                .tokenExpiresAt(kenh.getTokenExpiresAt())
                .isTokenExpired(isExpired)
                .secondsUntilExpiration(secondsUntilExpiration)
                .trangThai(kenh.getTrangThai())
                .ngayCapNhat(kenh.getNgayCapNhat())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShopifyConfigResponse updateShopifyConfig(ShopifyConfigUpdating request) {
        if (request.getShopDomain() == null || request.getShopDomain().isBlank()) {
            throw new CommonException("Shopify Store Domain không được để trống", HttpStatus.BAD_REQUEST, null);
        }

        String cleanDomain = sanitizeShopDomain(request.getShopDomain());
        String apiUrl = "https://" + cleanDomain + "/admin/api/" + DEFAULT_API_VERSION;

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY)
                .orElseGet(() -> KenhBanHang.builder()
                        .maKenh(MA_KENH_SHOPIFY)
                        .tenKenh("Cửa hàng Shopify")
                        .loaiKenh("online")
                        .trangThai(1)
                        .build());

        kenh.setTenKenh("Cửa hàng Shopify");
        kenh.setLoaiKenh("online");
        kenh.setApiUrl(apiUrl);
        if (request.getTrangThai() != null) {
            kenh.setTrangThai(request.getTrangThai());
        }

        // Mã hóa và lưu Access Token nếu được truyền mới
        if (request.getAccessToken() != null && !request.getAccessToken().isBlank()) {
            String encryptedToken = paymentSecretCipher.encrypt(request.getAccessToken().trim());
            kenh.setApiKey(encryptedToken);
        }

        // Mã hóa và lưu API Secret / Webhook Secret nếu được truyền mới
        if (request.getApiSecret() != null && !request.getApiSecret().isBlank()) {
            String encryptedSecret = paymentSecretCipher.encrypt(request.getApiSecret().trim());
            kenh.setApiSecret(encryptedSecret);
        }

        // Lưu Client ID nếu được truyền
        if (request.getClientId() != null) {
            kenh.setClientId(request.getClientId().trim().isBlank() ? null : request.getClientId().trim());
        }

        // Mã hóa và lưu Refresh Token nếu được truyền mới
        if (request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            String encryptedRefresh = paymentSecretCipher.encrypt(request.getRefreshToken().trim());
            kenh.setRefreshToken(encryptedRefresh);
        }

        // Lưu thời điểm hết hạn nếu được truyền
        if (request.getTokenExpiresAt() != null) {
            kenh.setTokenExpiresAt(request.getTokenExpiresAt());
        }

        KenhBanHang saved = kenhBanHangRepository.save(kenh);

        // Ghi Audit Trail
        ghiLichSuThayDoi(saved, cleanDomain);

        return getShopifyConfig();
    }

    @Override
    public ShopifyTestConnectionResponse testShopifyConnection(ShopifyTestConnectionRequest request) {
        String tokenToTest = null;
        if (request.getAccessToken() != null && !request.getAccessToken().isBlank()) {
            tokenToTest = request.getAccessToken().trim();
        } else {
            tokenToTest = getDecryptedShopifyAccessToken();
        }

        if (tokenToTest == null || tokenToTest.isBlank()) {
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Chưa có Admin Access Token để kiểm tra kết nối")
                    .build();
        }

        String domain = null;
        if (request.getShopDomain() != null && !request.getShopDomain().isBlank()) {
            domain = sanitizeShopDomain(request.getShopDomain());
        } else {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
            if (kenh != null && kenh.getApiUrl() != null) {
                domain = extractDomainFromApiUrl(kenh.getApiUrl());
            }
        }

        if (domain == null || domain.isBlank()) {
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Chưa có Shopify Store Domain để kiểm tra kết nối")
                    .build();
        }

        String testUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/shop.json";

        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(3000);
            factory.setReadTimeout(5000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", tokenToTest);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(testUrl, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode shopNode = root.path("shop");
                String name = shopNode.path("name").asText(domain);
                String email = shopNode.path("email").asText("");
                String myshopifyDomain = shopNode.path("myshopify_domain").asText(domain);

                return ShopifyTestConnectionResponse.builder()
                        .connected(true)
                        .shopName(name)
                        .shopEmail(email)
                        .myshopifyDomain(myshopifyDomain)
                        .message("Kết nối thành công tới cửa hàng Shopify: " + name)
                        .build();
            } else {
                return ShopifyTestConnectionResponse.builder()
                        .connected(false)
                        .message("Shopify trả về mã trạng thái: " + response.getStatusCode())
                        .build();
            }
        } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
            log.warn("Shopify test connection failed (auth error): {}", e.getMessage());
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Access Token không hợp lệ hoặc không có quyền truy cập Shopify Admin API")
                    .build();
        } catch (Exception e) {
            log.error("Shopify test connection failed: {}", e.getMessage());
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Không thể kết nối tới Shopify: " + e.getMessage())
                    .build();
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String getDecryptedShopifyAccessToken() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
        if (kenh == null || kenh.getApiKey() == null || kenh.getApiKey().isBlank()) {
            return null;
        }

        // Proactive Refresh: nếu là OAuth 2.0 token sắp hết hạn và có refresh token
        if (isOAuthTokenExpiringSoon(kenh)) {
            tokenRefreshLock.lock();
            try {
                // Double check sau khi acquire lock để tránh race condition
                kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
                if (kenh != null && isOAuthTokenExpiringSoon(kenh)) {
                    boolean ok = doRefreshShopifyOAuthToken(kenh);
                    if (ok) {
                        kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
                    }
                }
            } finally {
                tokenRefreshLock.unlock();
            }
        }

        if (kenh == null || kenh.getApiKey() == null) {
            return null;
        }
        try {
            return paymentSecretCipher.decrypt(kenh.getApiKey());
        } catch (Exception e) {
            log.error("Lỗi giải mã token Shopify: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public boolean refreshShopifyAccessToken() {
        tokenRefreshLock.lock();
        try {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
            if (kenh == null) {
                throw new CommonException("Chưa cấu hình kênh bán hàng Shopify", HttpStatus.BAD_REQUEST, null);
            }
            if (kenh.getRefreshToken() == null || kenh.getRefreshToken().isBlank()) {
                throw new CommonException("Kênh Shopify đang sử dụng Static Token hoặc chưa cấu hình Refresh Token OAuth 2.0", HttpStatus.BAD_REQUEST, null);
            }
            return doRefreshShopifyOAuthToken(kenh);
        } finally {
            tokenRefreshLock.unlock();
        }
    }

    private boolean doRefreshShopifyOAuthToken(KenhBanHang kenh) {
        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            log.error("Không thể refresh token: domain Shopify rỗng");
            return false;
        }

        String decryptedRefreshToken = null;
        try {
            decryptedRefreshToken = paymentSecretCipher.decrypt(kenh.getRefreshToken());
        } catch (Exception e) {
            log.error("Không thể giải mã Refresh Token: {}", e.getMessage());
            return false;
        }

        String decryptedClientSecret = null;
        if (kenh.getApiSecret() != null && !kenh.getApiSecret().isBlank()) {
            try {
                decryptedClientSecret = paymentSecretCipher.decrypt(kenh.getApiSecret());
            } catch (Exception e) {
                log.warn("Không thể giải mã apiSecret làm client_secret: {}", e.getMessage());
            }
        }

        String clientId = kenh.getClientId();
        String refreshUrl = "https://" + domain + "/admin/oauth/access_token";

        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(5000);
            factory.setReadTimeout(10000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

            java.util.Map<String, String> body = new java.util.HashMap<>();
            body.put("client_id", clientId != null ? clientId : "");
            body.put("client_secret", decryptedClientSecret != null ? decryptedClientSecret : "");
            body.put("grant_type", "refresh_token");
            body.put("refresh_token", decryptedRefreshToken);

            HttpEntity<java.util.Map<String, String>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(refreshUrl, HttpMethod.POST, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String newAccessToken = root.path("access_token").asText(null);
                String newRefreshToken = root.path("refresh_token").asText(null);
                long expiresIn = root.path("expires_in").asLong(3600);

                if (newAccessToken != null && !newAccessToken.isBlank()) {
                    kenh.setApiKey(paymentSecretCipher.encrypt(newAccessToken));
                    if (newRefreshToken != null && !newRefreshToken.isBlank()) {
                        kenh.setRefreshToken(paymentSecretCipher.encrypt(newRefreshToken));
                    }
                    kenh.setTokenExpiresAt(Instant.now().plusSeconds(expiresIn));
                    kenhBanHangRepository.save(kenh);
                    ghiLichSuThayDoi(kenh, domain);
                    log.info("Làm mới thành công Access Token Shopify cho domain: {}, thời hạn mới: {}s", domain, expiresIn);
                    return true;
                }
            }
            return false;
        } catch (HttpClientErrorException e) {
            log.error("Shopify OAuth refresh error [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new CommonException("Làm mới Shopify OAuth Token thất bại: " + e.getStatusCode(), HttpStatus.UNAUTHORIZED, null);
        } catch (Exception e) {
            log.error("Lỗi ngoại lệ khi làm mới Shopify OAuth Token: {}", e.getMessage());
            return false;
        }
    }

    private boolean isOAuthTokenExpiringSoon(KenhBanHang kenh) {
        if (kenh.getRefreshToken() == null || kenh.getRefreshToken().isBlank()) {
            return false;
        }
        if (kenh.getTokenExpiresAt() == null) {
            return false;
        }
        // Chủ động làm mới nếu token sẽ hết hạn trong vòng 5 phút (300 giây)
        return Instant.now().plusSeconds(300).isAfter(kenh.getTokenExpiresAt());
    }

    private String maskRefreshToken(String plain) {
        if (plain == null || plain.isBlank()) return "";
        if (plain.length() <= 8) {
            return "••••••••";
        }
        String prefix = plain.startsWith("shprt_") ? "shprt_" : "";
        String suffix = plain.substring(plain.length() - 4);
        return prefix + "••••••••" + suffix;
    }

    @Override
    @Transactional(readOnly = true)
    public String getShopifyApiUrl() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
        return kenh != null ? kenh.getApiUrl() : null;
    }

    private String sanitizeShopDomain(String rawDomain) {
        if (rawDomain == null) return "";
        String domain = rawDomain.trim().toLowerCase();
        domain = domain.replace("https://", "").replace("http://", "");
        if (domain.contains("/")) {
            domain = domain.substring(0, domain.indexOf("/"));
        }
        return domain;
    }

    private String extractDomainFromApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) return "";
        return sanitizeShopDomain(apiUrl);
    }

    private String maskToken(String plain) {
        if (plain == null || plain.isBlank()) return "";
        if (plain.length() <= 8) {
            return "••••••••";
        }
        String prefix = plain.startsWith("shpat_") ? "shpat_" : "";
        String suffix = plain.substring(plain.length() - 4);
        return prefix + "••••••••" + suffix;
    }

    private void ghiLichSuThayDoi(KenhBanHang kenh, String domain) {
        try {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            NguoiDung nguoiThucHien = null;
            if (auth != null && auth.getId() != null) {
                nguoiThucHien = nguoiDungRepository.findById(auth.getId()).orElse(null);
            }
            if (nguoiThucHien != null) {
                lichSuThayDoiService.create(
                        LichSuThayDoi.builder()
                                .loaiThamChieu(ITable.kenh_ban_hang)
                                .idThamChieu(kenh.getId())
                                .hanhDong(IHanhDong.cap_nhat_kenh_ban)
                                .giaTriMoi("Cập nhật kết nối Shopify domain: " + domain)
                                .nguoiThucHien(nguoiThucHien)
                                .ngayThucHien(Instant.now())
                                .ghiChu("Mã hóa AES-256-GCM credential kênh bán")
                                .build()
                );
            }
        } catch (Exception e) {
            log.warn("Không thể ghi log lịch sử thay đổi cho kênh bán: {}", e.getMessage());
        }
    }
}

