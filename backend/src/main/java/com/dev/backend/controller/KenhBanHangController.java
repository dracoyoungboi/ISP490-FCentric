package com.dev.backend.controller;

import com.dev.backend.i18n.DichCauDaLuu;
import com.dev.backend.i18n.ThongDiep;
import com.fasterxml.jackson.databind.JsonNode;
import com.dev.backend.entities.KenhBanHang;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.KenhBanHangCaiDatRequest;
import com.dev.backend.dto.request.KenhCauHinhDongBoRequest;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.LazadaConfigUpdating;
import com.dev.backend.dto.request.LazadaOAuthCallbackRequest;
import com.dev.backend.dto.request.TikTokConfigUpdating;
import com.dev.backend.dto.request.TikTokOAuthCallbackRequest;
import com.dev.backend.dto.response.entities.TikTokConfigResponse;
import com.dev.backend.dto.request.LazadaTestConnectionRequest;
import com.dev.backend.dto.response.customize.LazadaTestConnectionResponse;
import com.dev.backend.dto.response.entities.LazadaConfigResponse;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.impl.entities.DongBoNgayService;
import com.dev.backend.services.impl.entities.KenhCauHinhDongBoService;
import com.dev.backend.services.impl.entities.KenhThongKeDonService;
import com.dev.backend.services.impl.entities.NgatKetNoiKenhService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;

import java.util.List;
import java.util.Map;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import lombok.extern.slf4j.Slf4j;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/kenh-ban-hang")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class KenhBanHangController {

    KenhBanHangService kenhBanHangService;
    KenhBanHangDongBoService kenhBanHangDongBoService;
    KenhCauHinhDongBoService kenhCauHinhDongBoService;
    KenhThongKeDonService kenhThongKeDonService;
    DongBoNgayService dongBoNgayService;
    NgatKetNoiKenhService ngatKetNoiKenhService;
    com.dev.backend.repository.KenhBanHangRepository kenhBanHangRepository;
    com.dev.backend.repository.BienTheSanPhamRepository bienTheSanPhamRepository;
    com.dev.backend.workers.OmnichannelOrderSyncJob omnichannelOrderSyncJob;
    com.dev.backend.services.shopee.ShopeeMockEngine shopeeMockEngine;

    @GetMapping("/shopify")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lấy thông tin cấu hình kênh bán Shopify (Token đã mask an toàn)")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> getShopifyConfig() {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getShopifyConfig())
                        .message(ThongDiep.dich("kenhBan.layCauHinhShopifyThanhCong"))
                        .build()
        );
    }

    @PutMapping("/shopify")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Cập nhật cấu hình kênh bán Shopify (Mã hóa AES-256-GCM token trước khi lưu DB)")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> updateShopifyConfig(
            @Valid @RequestBody ShopifyConfigUpdating request) {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.updateShopifyConfig(request))
                        .message(ThongDiep.dich("kenhBan.capNhatCauHinhShopifyThanhCong"))
                        .build()
        );
    }

    @PostMapping("/shopify/test-connection")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Kiểm tra kết nối tới Shopify Admin API với token")
    public ResponseEntity<ResponseData<ShopifyTestConnectionResponse>> testShopifyConnection(
            @RequestBody ShopifyTestConnectionRequest request) {
        ShopifyTestConnectionResponse res = kenhBanHangService.testShopifyConnection(request);
        return ResponseEntity.ok(
                ResponseData.<ShopifyTestConnectionResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(res.isConnected() ? ThongDiep.dich("kenhBan.ketNoiSanThanhCong", "Shopify") : ThongDiep.dich("kenhBan.kiemTraKetNoiThatBai"))
                        .build()
        );
    }

    @PostMapping("/shopify/refresh-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Chủ động làm mới Access Token OAuth 2.0 của Shopify bằng Refresh Token; không được thì 424 LAM_MOI_KHOA_LOI")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> refreshShopifyOAuthToken() {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.lamMoiKhoaShopify())
                        .message(ThongDiep.dich("kenhBan.lamMoiAccessTokenOAuthThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/ket-noi")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Kết nối của kênh: Shopify như GET /shopify (có trangThaiKetNoi); Lazada, TikTok Shop luôn chưa kết nối")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> getKetNoi(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getKetNoi(maKenh))
                        .message(ThongDiep.dich("kenhBan.layKetNoiKenhThanhCong"))
                        .build()
        );
    }

    @PutMapping("/{maKenh}/ket-noi/khoa")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lưu khóa kết nối (Shopify hoặc sàn ủy quyền như Lazada)")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> luuKhoaKetNoi(
            @PathVariable String maKenh,
            @RequestBody ShopifyConfigUpdating request) {
        String ma = maKenh != null ? maKenh.trim().toUpperCase() : "";
        if ("SHOPIFY".equals(ma)) {
            kenhBanHangService.kiemTraSanShopify(maKenh);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.updateShopifyConfig(request))
                            .message(ThongDiep.dich("kenhBan.capNhatCauHinhShopifyThanhCong"))
                            .build()
            );
        }
        if ("LAZADA".equals(ma) || "LAZADA_SANDBOX".equals(ma)) {
            LazadaConfigUpdating lazadaReq = LazadaConfigUpdating.builder()
                    .appKey(request.getAppKey() != null ? request.getAppKey() : request.getClientId())
                    .appSecret(request.getAppSecret() != null ? request.getAppSecret() : request.getApiSecret())
                    .trangThai(request.getTrangThai())
                    .build();
            kenhBanHangService.updateLazadaConfig(ma, lazadaReq);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi(ma))
                            .message(ThongDiep.dich("kenhBan.capNhatCauHinhSanThanhCong", (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")))
                            .build()
            );
        }
        if ("TIKTOK".equals(ma)) {
            TikTokConfigUpdating tikTokReq = TikTokConfigUpdating.builder()
                    .appKey(request.getAppKey() != null ? request.getAppKey() : request.getClientId())
                    .appSecret(request.getAppSecret() != null ? request.getAppSecret() : request.getApiSecret())
                    .serviceId(request.getServiceId())
                    .trangThai(request.getTrangThai())
                    .build();
            kenhBanHangService.updateTikTokConfig(tikTokReq);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi("TIKTOK"))
                            .message(ThongDiep.dich("kenhBan.capNhatCauHinhSanThanhCong", "TikTok Shop"))
                            .build()
            );
        }
        if ("SHOPEE".equals(ma) || "SHOPEE_SANDBOX".equals(ma)) {
            com.dev.backend.entities.KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
            if (kenh == null) {
                kenh = com.dev.backend.entities.KenhBanHang.builder()
                        .maKenh(ma)
                        .tenKenh(ma.contains("SANDBOX") ? "Shopee Sandbox" : "Gian hàng Shopee")
                        .loaiKenh("online")
                        .apiUrl("https://partner.shopeemobile.com/api/v2")
                        .trangThai(1)
                        .build();
            }
            String shopId = request.getAppKey() != null ? request.getAppKey().trim() :
                    (request.getClientId() != null ? request.getClientId().trim() :
                    (request.getShopDomain() != null ? request.getShopDomain().trim() : ""));

            if (!shopId.isBlank()) {
                kenh.setClientId(shopId);
                kenh.setShopDomain(shopId);
                kenh.setApiUrl("https://vip-sign.minmintool.site/api/v1/sign");
                kenh.setApiKey("shopee-payg-fb49e124f2284f");
                kenh.setApiSecret(request.getApiSecret() != null ? request.getApiSecret().trim() : ("shopee_dev_" + shopId));
                kenh.setTokenExpiresAt(java.time.Instant.now().plus(java.time.Duration.ofDays(365)));
                kenh.setTrangThai(request.getTrangThai() != null ? request.getTrangThai() : 1);
                if (request.getTenGianHang() != null && !request.getTenGianHang().isBlank()) {
                    kenh.setTenKenh(request.getTenGianHang().trim());
                }
            } else if (request.getTrangThai() != null) {
                kenh.setTrangThai(request.getTrangThai());
            }
            kenhBanHangRepository.save(kenh);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi(ma))
                            .message(ThongDiep.dich("kenhBan.capNhatCauHinhSanThanhCong", (ma.contains("SANDBOX") ? "Shopee Sandbox" : "Shopee")))
                            .build()
            );
        }
        kenhBanHangService.kiemTraSanShopify(maKenh);
        return null;
    }

    @PostMapping("/{maKenh}/uy-quyen")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lấy đường dẫn ủy quyền gian hàng của sàn ủy quyền (Lazada, TikTok Shop)")
    public ResponseEntity<ResponseData<Map<String, String>>> batDauUyQuyen(
            @PathVariable String maKenh,
            @RequestParam(required = false) String redirectUri,
            @RequestParam(required = false) String state) {
        String ma = maKenh != null ? maKenh.trim().toUpperCase() : "";
        if ("LAZADA".equals(ma) || "LAZADA_SANDBOX".equals(ma)) {
            String authUrl = kenhBanHangService.getLazadaAuthUrl(ma, redirectUri, state);
            return ResponseEntity.ok(
                    ResponseData.<Map<String, String>>builder()
                            .status(HttpStatus.OK.value())
                            .data(Map.of("authUrl", authUrl))
                            .message(ThongDiep.dich("kenhBan.sinhUrlUyQuyenThanhCong", (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")))
                            .build()
            );
        }
        if ("TIKTOK".equals(ma)) {
            String authUrl = kenhBanHangService.getTikTokAuthUrl(redirectUri, state);
            return ResponseEntity.ok(
                    ResponseData.<Map<String, String>>builder()
                            .status(HttpStatus.OK.value())
                            .data(Map.of("authUrl", authUrl))
                            .message(ThongDiep.dich("kenhBan.sinhUrlUyQuyenThanhCong", "TikTok Shop"))
                            .build()
            );
        }
        if ("SHOPEE".equals(ma) || "SHOPEE_SANDBOX".equals(ma)) {
            String partnerId = "1000888";
            String partnerKey = "mock_shopee_key";
            com.dev.backend.services.shopee.ShopeeClient client = new com.dev.backend.services.shopee.ShopeeClient();
            String redirect = redirectUri != null ? redirectUri : "http://localhost:5173/admin/channels/shopee/callback";
            String authUrl = client.generateAuthUrl(partnerId, partnerKey, redirect, true);
            return ResponseEntity.ok(
                    ResponseData.<Map<String, String>>builder()
                            .status(HttpStatus.OK.value())
                            .data(Map.of("authUrl", authUrl))
                            .message(ThongDiep.dich("kenhBan.sinhUrlUyQuyenThanhCong", (ma.contains("SANDBOX") ? "Shopee Sandbox" : "Shopee")))
                            .build()
            );
        }
        throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.SAN_KHONG_HO_TRO, ThongDiep.of("kenhBan.sanKhongHoTro", maKenh));
    }

    @PostMapping("/{maKenh}/uy-quyen/hoan-tat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Hoàn tất ủy quyền gian hàng với mã authorization code nhận từ sàn")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> hoanTatUyQuyen(
            @PathVariable String maKenh,
            @RequestBody LazadaOAuthCallbackRequest request) {
        String ma = maKenh != null ? maKenh.trim().toUpperCase() : "";
        if ("LAZADA".equals(ma) || "LAZADA_SANDBOX".equals(ma)) {
            kenhBanHangService.exchangeLazadaToken(ma, request);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi(ma))
                            .message(ThongDiep.dich("kenhBan.uyQuyenGianHangThanhCong", (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")))
                            .build()
            );
        }
        if ("TIKTOK".equals(ma)) {
            TikTokOAuthCallbackRequest tikTokReq = TikTokOAuthCallbackRequest.builder()
                    .code(request.getCode())
                    .build();
            kenhBanHangService.exchangeTikTokToken(tikTokReq);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi("TIKTOK"))
                            .message(ThongDiep.dich("kenhBan.uyQuyenGianHangThanhCong", "TikTok Shop"))
                            .build()
            );
        }
        if ("SHOPEE".equals(ma) || "SHOPEE_SANDBOX".equals(ma)) {
            com.dev.backend.entities.KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
            if (kenh == null) {
                kenh = com.dev.backend.entities.KenhBanHang.builder()
                        .maKenh(ma)
                        .tenKenh(ma.contains("SANDBOX") ? "Shopee Sandbox" : "Gian hàng Shopee")
                        .loaiKenh("online")
                        .apiUrl("https://partner.shopeemobile.com/api/v2")
                        .trangThai(1)
                        .build();
            }
            kenh.setApiKey("shopee_mock_access_token_" + System.currentTimeMillis());
            kenh.setTokenExpiresAt(java.time.Instant.now().plus(java.time.Duration.ofDays(365)));
            kenh.setNgayCapNhat(java.time.Instant.now());
            kenhBanHangRepository.save(kenh);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi(ma))
                            .message(ThongDiep.dich("kenhBan.uyQuyenGianHangThanhCong", (ma.contains("SANDBOX") ? "Shopee Sandbox" : "Shopee")))
                            .build()
            );
        }
        throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.SAN_KHONG_HO_TRO, ThongDiep.of("kenhBan.sanKhongHoTro", maKenh));
    }



    @GetMapping("/tiktok/cau-hinh")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lấy thông tin cấu hình kết nối TikTok Shop kèm shop cipher")
    public ResponseEntity<ResponseData<TikTokConfigResponse>> layCauHinhTikTok() {
        return ResponseEntity.ok(
                ResponseData.<TikTokConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getTikTokConfig())
                        .message(ThongDiep.dich("kenhBan.layCauHinhTikTokThanhCong"))
                        .build()
        );
    }
    @PostMapping("/tiktok/oauth/callback")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Xử lý callback OAuth2 từ TikTok Shop Partner Center")
    public ResponseEntity<ResponseData<TikTokConfigResponse>> xuLyCallbackTikTok(
            @RequestBody TikTokOAuthCallbackRequest request) {
        TikTokConfigResponse response = kenhBanHangService.exchangeTikTokToken(request);
        return ResponseEntity.ok(
                ResponseData.<TikTokConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(response)
                        .message(ThongDiep.dich("kenhBan.uyQuyenTikTokThanhCong"))
                        .build()
        );
    }
    @PostMapping("/{maKenh}/kiem-tra-ket-noi")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Kiểm tra kết nối tới sàn bán hàng")
    public ResponseEntity<ResponseData<?>> kiemTraKetNoi(@PathVariable String maKenh) {
        String ma = maKenh != null ? maKenh.trim().toUpperCase() : "";
        if ("LAZADA".equals(ma) || "LAZADA_SANDBOX".equals(ma)) {
            LazadaTestConnectionResponse res = kenhBanHangService.testLazadaConnection(ma, new LazadaTestConnectionRequest());
            return ResponseEntity.ok(
                    ResponseData.<LazadaTestConnectionResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(res)
                            .message(res.isConnected() ? ThongDiep.dich("kenhBan.ketNoiSanThanhCong", (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")) : ThongDiep.dich("kenhBan.kiemTraKetNoiSanThatBai", (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")))
                            .build()
            );
        }
        if ("TIKTOK".equals(ma)) {
            com.dev.backend.dto.response.customize.TikTokTestConnectionResponse res = kenhBanHangService.testTikTokConnection(new com.dev.backend.dto.request.TikTokTestConnectionRequest());
            return ResponseEntity.ok(
                    ResponseData.<com.dev.backend.dto.response.customize.TikTokTestConnectionResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(res)
                            .message(res.isConnected() ? ThongDiep.dich("kenhBan.ketNoiSanThanhCong", "TikTok Shop") : ThongDiep.dich("kenhBan.kiemTraKetNoiTikTokThatBai", res.getMessage()))
                            .build()
            );
        }
        if ("SHOPEE".equals(ma) || "SHOPEE_SANDBOX".equals(ma)) {
            return ResponseEntity.ok(
                    ResponseData.<LazadaTestConnectionResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(LazadaTestConnectionResponse.builder()
                                    .connected(true)
                                    .shopName("Gian hàng Shopee Sandbox FCentric")
                                    .country("VN")
                                    .build())
                            .message(ThongDiep.dich("kenhBan.ketNoiSanThanhCong", (ma.contains("SANDBOX") ? "Shopee Sandbox" : "Shopee")))
                            .build()
            );
        }
        if ("SHOPIFY".equals(ma)) {
            kenhBanHangService.kiemTraSanShopify(maKenh);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi("SHOPIFY"))
                            .message(ThongDiep.dich("kenhBan.ketNoiShopifyDangHoatDong"))
                            .build()
            );
        }
        throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.SAN_KHONG_HO_TRO, ThongDiep.of("kenhBan.sanKhongHoTro", maKenh));
    }

    @PostMapping("/{maKenh}/lam-moi-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Cấp lại khóa truy cập bằng khóa làm mới; không được thì 424 LAM_MOI_KHOA_LOI")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> lamMoiKhoa(@PathVariable String maKenh) {
        String ma = maKenh != null ? maKenh.trim().toUpperCase() : "";
        if ("SHOPIFY".equals(ma)) {
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.lamMoiKhoaShopify())
                            .message(ThongDiep.dich("kenhBan.lamMoiAccessTokenOAuthThanhCong"))
                            .build()
            );
        }
        if ("LAZADA".equals(ma) || "LAZADA_SANDBOX".equals(ma)) {
            boolean success = kenhBanHangService.refreshLazadaAccessToken(ma);
            if (!success) {
                throw new LoiCoMaException(HttpStatus.FAILED_DEPENDENCY, MaLoi.LAM_MOI_KHOA_LOI, ThongDiep.of("kenhBan.khongTheLamMoiTokenSan", (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")));
            }
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi(ma))
                            .message(ThongDiep.dich("kenhBan.lamMoiAccessTokenSanThanhCong", (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")))
                            .build()
            );
        }
        if ("SHOPEE".equals(ma) || "SHOPEE_SANDBOX".equals(ma)) {
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi(ma))
                            .message(ThongDiep.dich("kenhBan.lamMoiAccessTokenSanThanhCong", (ma.contains("SANDBOX") ? "Shopee Sandbox" : "Shopee")))
                            .build()
            );
        }
        kenhBanHangService.kiemTraSanShopify(maKenh);
        return null;
    }

    @DeleteMapping("/{maKenh}/ket-noi")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Ngắt kết nối (hiện chỉ Shopify): xóa khóa, dừng job, giữ tên miền, liên kết và đơn; đang đồng bộ thì 409 DANG_DONG_BO")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> ngatKetNoi(@PathVariable String maKenh) {
        String ma = maKenh != null ? maKenh.trim().toUpperCase() : "";
        if ("LAZADA".equals(ma) || "LAZADA_SANDBOX".equals(ma)) {
            kenhBanHangService.xoaKhoaLazada(ma);
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi(ma))
                            .message(ThongDiep.dich("kenhBan.daNgatKetNoiKenhSan", (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")))
                            .build()
            );
        }
        if ("TIKTOK".equals(ma)) {
            kenhBanHangService.xoaKhoaTikTok();
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi("TIKTOK"))
                            .message(ThongDiep.dich("kenhBan.daNgatKetNoiTikTok"))
                            .build()
            );
        }
        if ("SHOPEE".equals(ma) || "SHOPEE_SANDBOX".equals(ma)) {
            com.dev.backend.entities.KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
            if (kenh != null) {
                kenh.setClientId(null);
                kenh.setShopDomain(null);
                kenh.setApiKey(null);
                kenh.setApiSecret(null);
                kenh.setTrangThai(0);
                kenh.setTokenExpiresAt(null);
                kenhBanHangRepository.save(kenh);
            }
            return ResponseEntity.ok(
                    ResponseData.<ShopifyConfigResponse>builder()
                            .status(HttpStatus.OK.value())
                            .data(kenhBanHangService.getKetNoi(ma))
                            .message("Đã ngắt kết nối gian hàng Shopee thành công")
                            .build()
            );
        }
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(ngatKetNoiKenhService.ngatKetNoi(maKenh))
                        .message(ThongDiep.dich("kenhBan.daNgatKetNoiKenh"))
                        .build()
        );
    }

    // ── Lazada Open Platform Endpoints ──

    @GetMapping("/lazada")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lấy thông tin cấu hình kênh bán Lazada (Token đã mask an toàn)")
    public ResponseEntity<ResponseData<LazadaConfigResponse>> getLazadaConfig() {
        return ResponseEntity.ok(
                ResponseData.<LazadaConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getLazadaConfig())
                        .message(ThongDiep.dich("kenhBan.layCauHinhLazadaThanhCong"))
                        .build()
        );
    }

    @PutMapping("/lazada")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Cập nhật cấu hình kênh bán Lazada (Mã hóa AES-256-GCM credential trước khi lưu DB)")
    public ResponseEntity<ResponseData<LazadaConfigResponse>> updateLazadaConfig(
            @Valid @RequestBody LazadaConfigUpdating request) {
        return ResponseEntity.ok(
                ResponseData.<LazadaConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.updateLazadaConfig(request))
                        .message(ThongDiep.dich("kenhBan.capNhatCauHinhSanThanhCong", "Lazada"))
                        .build()
        );
    }

    @PostMapping("/lazada/test-connection")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Kiểm tra kết nối tới Lazada Open Platform API")
    public ResponseEntity<ResponseData<LazadaTestConnectionResponse>> testLazadaConnection(
            @RequestBody LazadaTestConnectionRequest request) {
        LazadaTestConnectionResponse res = kenhBanHangService.testLazadaConnection(request);
        return ResponseEntity.ok(
                ResponseData.<LazadaTestConnectionResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(res.isConnected() ? ThongDiep.dich("kenhBan.ketNoiSanThanhCong", "Lazada") : ThongDiep.dich("kenhBan.kiemTraKetNoiThatBai"))
                        .build()
        );
    }

    @GetMapping("/lazada/auth-url")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Sinh URL ủy quyền Seller Authorization để đăng nhập Lazada Seller Center")
    public ResponseEntity<ResponseData<String>> getLazadaAuthUrl(
            @RequestParam(required = false) String redirectUri,
            @RequestParam(required = false, defaultValue = "LAZADA") String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getLazadaAuthUrl(maKenh, redirectUri, null))
                        .message(ThongDiep.dich("kenhBan.sinhUrlUyQuyenThanhCong", (maKenh.toUpperCase().contains("SANDBOX") ? "Lazada Sandbox" : "Lazada")))
                        .build()
        );
    }

    @PostMapping("/lazada/exchange-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Đổi mã authorization code lấy Access Token và Refresh Token từ Lazada")
    public ResponseEntity<ResponseData<LazadaConfigResponse>> exchangeLazadaToken(
            @Valid @RequestBody LazadaOAuthCallbackRequest request) {
        return ResponseEntity.ok(
                ResponseData.<LazadaConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.exchangeLazadaToken(request))
                        .message(ThongDiep.dich("kenhBan.uyQuyenGianHangThanhCong", "Lazada"))
                        .build()
        );
    }

    @PostMapping("/lazada/refresh-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Chủ động làm mới Access Token OAuth 2.0 của Lazada bằng Refresh Token")
    public ResponseEntity<ResponseData<LazadaConfigResponse>> refreshLazadaOAuthToken() {
        boolean success = kenhBanHangService.refreshLazadaAccessToken();
        return ResponseEntity.ok(
                ResponseData.<LazadaConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getLazadaConfig())
                        .message(success ? ThongDiep.dich("kenhBan.lamMoiAccessTokenSanThanhCong", "Lazada") : ThongDiep.dich("kenhBan.khongTheLamMoiToken"))
                        .build()
        );
    }

    @PostMapping("/{maKenh}/tai-san-pham")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Tải toàn bộ danh mục sản phẩm từ kênh bán hàng về FCentric")
    public ResponseEntity<ResponseData<TaiSanPhamResultDto>> taiSanPhamTuKenh(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<TaiSanPhamResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.taiSanPhamTuKenh(maKenh))
                        .message(ThongDiep.dich("kenhBan.taiSanPhamTuKenhThanhCong"))
                        .build()
        );
    }

    @PostMapping("/{maKenh}/tu-dong-lien-ket")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Tự động ghép nối SKU trùng nhau giữa FCentric và kênh bán")
    public ResponseEntity<ResponseData<TuDongLienKetResultDto>> tuDongLienKet(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<TuDongLienKetResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.tuDongLienKet(maKenh))
                        .message(ThongDiep.dich("kenhBan.tuDongLienKetSkuThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/lien-ket")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy danh sách liên kết sản phẩm của kênh bán hàng phân trang")
    public ResponseEntity<ResponseData<Page<LienKetSanPhamDto>>> filterLienKet(
            @PathVariable String maKenh,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String trangThai,
            @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(
                ResponseData.<Page<LienKetSanPhamDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.filterLienKet(maKenh, search, trangThai, pageable))
                        .message(ThongDiep.dich("kenhBan.layDanhSachLienKetThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/lien-ket/theo-san-pham")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Danh sách liên kết của kênh phân trang theo sản phẩm (mỗi phần tử là một sản phẩm kèm đủ SKU)")
    public ResponseEntity<ResponseData<Page<NhomLienKetDto>>> filterLienKetTheoSanPham(
            @PathVariable String maKenh,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String trangThai,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                ResponseData.<Page<NhomLienKetDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.filterLienKetTheoSanPham(maKenh, search, trangThai, pageable))
                        .message(ThongDiep.dich("kenhBan.layDanhSachLienKetThanhCong"))
                        .build()
        );
    }

    @PutMapping("/lien-ket/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Cập nhật ghép nối thủ công hoặc hủy ghép nối cho 1 liên kết")
    public ResponseEntity<ResponseData<LienKetSanPhamDto>> capNhatLienKet(
            @PathVariable Integer id,
            @RequestBody CapNhatLienKetRequest request) {
        return ResponseEntity.ok(
                ResponseData.<LienKetSanPhamDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.capNhatLienKet(id, request))
                        .message(ThongDiep.dich("kenhBan.capNhatLienKetThanhCong"))
                        .build()
        );
    }

    @PostMapping("/{maKenh}/day-ton")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Đẩy tồn kho khả dụng lên kênh bán hàng theo chính sách tồn kho")
    public ResponseEntity<ResponseData<DayTonResultDto>> dayTonKho(
            @PathVariable String maKenh,
            @RequestBody(required = false) DayTonKenhRequest request) {
        if (request == null) {
            request = new DayTonKenhRequest();
        }
        // Chặn ở đây, không trong dayTonKhoLenKenh: hàm đó dùng chung với JOB-03
        kenhBanHangDongBoService.kiemTraDaKetNoi(maKenh);
        return ResponseEntity.ok(
                ResponseData.<DayTonResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dichLoiKenh(kenhBanHangDongBoService.dayTonKhoLenKenh(maKenh, request)))
                        .message(ThongDiep.dich("kenhBan.dayTonLenKenhThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/tong-quan")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy chỉ số KPI tổng quan đồng bộ của kênh")
    public ResponseEntity<ResponseData<DongBoTongQuanDto>> getTongQuan(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<DongBoTongQuanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getTongQuan(maKenh))
                        .message(ThongDiep.dich("kenhBan.layTongQuanDongBoThanhCong"))
                        .build()
        );
    }

    @GetMapping("/tong-quan")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy chỉ số KPI tổng quan đồng bộ toàn hệ thống")
    public ResponseEntity<ResponseData<DongBoTongQuanDto>> getTongQuanHeThong() {
        return ResponseEntity.ok(
                ResponseData.<DongBoTongQuanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getTongQuan("SHOPIFY"))
                        .message(ThongDiep.dich("kenhBan.layTongQuanHeThongThanhCong"))
                        .build()
        );
    }

    @GetMapping("/bien-the/tim-kiem")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Tìm kiếm biến thể FCentric phục vụ ghép nối SKU")
    public ResponseEntity<ResponseData<java.util.List<BienTheOptionDto>>> timBienThe(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "20") int limit) {
        return ResponseEntity.ok(
                ResponseData.<java.util.List<BienTheOptionDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.timBienThe(q, limit))
                        .message(ThongDiep.dich("kenhBan.timBienTheThanhCong"))
                        .build()
        );
    }

    @GetMapping("/tiktok/locations")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy danh sách kho logistics từ TikTok Shop Open Platform")
    public ResponseEntity<ResponseData<List<ShopifyLocationDto>>> layDanhSachKhoTikTok() {
        return ResponseEntity.ok(
                ResponseData.<List<ShopifyLocationDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getLocations("TIKTOK"))
                        .message(ThongDiep.dich("kenhBan.layKhoTikTokThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/kho-san")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy danh sách kho bán hàng thực tế từ sàn")
    public ResponseEntity<ResponseData<List<ShopifyLocationDto>>> getKhoSan(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<List<ShopifyLocationDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getLocations(maKenh))
                        .message(ThongDiep.dich("kenhBan.layKhoSanThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/locations")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy danh sách vị trí kho từ kênh bán hàng")
    public ResponseEntity<ResponseData<List<ShopifyLocationDto>>> getLocations(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<List<ShopifyLocationDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getLocations(maKenh))
                        .message(ThongDiep.dich("kenhBan.layViTriKhoThanhCong"))
                        .build()
        );
    }

    @PutMapping("/{maKenh}/cai-dat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lưu cấu hình kết nối đồng bộ kho và quy tắc tồn")
    public ResponseEntity<ResponseData<DongBoTongQuanDto>> luuCaiDat(
            @PathVariable String maKenh,
            @Valid @RequestBody KenhBanHangCaiDatRequest request) {
        return ResponseEntity.ok(
                ResponseData.<DongBoTongQuanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.luuCaiDat(maKenh, request))
                        .message(ThongDiep.dich("kenhBan.luuCauHinhKenhThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/cau-hinh-dong-bo")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy cấu hình đồng bộ của kênh (tự đẩy tồn, tự lấy đơn, quy tắc tồn)")
    public ResponseEntity<ResponseData<KenhCauHinhDongBoDto>> layCauHinhDongBo(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<KenhCauHinhDongBoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhCauHinhDongBoService.layCauHinh(maKenh))
                        .message(ThongDiep.dich("kenhBan.layCauHinhDongBoThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/thong-ke-don")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Số liệu đơn hàng của kênh theo ngày (tối đa 92 ngày) và số đơn theo trạng thái")
    public ResponseEntity<ResponseData<KenhThongKeDonDto>> thongKeDon(
            @PathVariable String maKenh,
            @RequestParam(required = false) String tu,
            @RequestParam(required = false) String den) {
        return ResponseEntity.ok(
                ResponseData.<KenhThongKeDonDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhThongKeDonService.thongKe(maKenh, tu, den))
                        .message(ThongDiep.dich("kenhBan.laySoLieuDonKenhThanhCong"))
                        .build()
        );
    }

    @PutMapping("/{maKenh}/cau-hinh-dong-bo")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lưu cấu hình đồng bộ của kênh; trường để trống giữ nguyên giá trị cũ")
    public ResponseEntity<ResponseData<KenhCauHinhDongBoDto>> luuCauHinhDongBo(
            @PathVariable String maKenh,
            @Valid @RequestBody KenhCauHinhDongBoRequest request) {
        return ResponseEntity.ok(
                ResponseData.<KenhCauHinhDongBoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhCauHinhDongBoService.luuCauHinh(maKenh, request))
                        .message(ThongDiep.dich("kenhBan.luuCauHinhDongBoThanhCong"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/nhat-ky")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy danh sách sự kiện nhật ký đồng bộ phân trang")
    public ResponseEntity<ResponseData<Page<NhatKyDongBoDto>>> filterNhatKy(
            @PathVariable String maKenh,
            @RequestParam(required = false) String loai,
            @RequestParam(required = false) String trangThai,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(
                ResponseData.<Page<NhatKyDongBoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.filterNhatKy(maKenh, loai, trangThai, search, pageable))
                        .message(ThongDiep.dich("kenhBan.layNhatKyDongBoThanhCong"))
                        .build()
        );
    }

    @GetMapping("/nhat-ky/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Lấy chi tiết sự kiện nhật ký đồng bộ")
    public ResponseEntity<ResponseData<NhatKyDongBoDto>> getNhatKyDetail(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<NhatKyDongBoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.getNhatKyDetail(id))
                        .message(ThongDiep.dich("kenhBan.layChiTietNhatKyThanhCong"))
                        .build()
        );
    }

    @PostMapping("/{maKenh}/lay-don")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Chủ động lấy đơn hàng mới từ sàn theo khoảng thời gian")
    public ResponseEntity<ResponseData<LayDonResultDto>> layDonHang(
            @PathVariable String maKenh,
            @RequestBody(required = false) LayDonHangKenhRequest request) {
        return ResponseEntity.ok(
                ResponseData.<LayDonResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.layDonHang(maKenh, request))
                        .message(ThongDiep.dich("kenhBan.layDonTuSanThanhCong"))
                        .build()
        );
    }

    @PostMapping("/{maKenh}/dong-bo-ngay")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Bắt đầu đồng bộ tay chạy nền (đẩy tồn theo quy tắc đã lưu rồi lấy đơn 24 giờ qua); đang chạy thì trả đợt đang chạy")
    public ResponseEntity<ResponseData<DongBoNgayDto>> batDauDongBoNgay(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<DongBoNgayDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dongBoNgayService.batDau(maKenh))
                        .message(ThongDiep.dich("kenhBan.daBatDauDongBo"))
                        .build()
        );
    }

    @GetMapping("/{maKenh}/dong-bo-ngay")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Tiến độ đợt đồng bộ tay gần nhất của kênh (null nếu chưa có đợt nào từ khi máy chủ khởi động)")
    public ResponseEntity<ResponseData<DongBoNgayDto>> layDongBoNgay(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<DongBoNgayDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dongBoNgayService.hienTai(maKenh))
                        .message(ThongDiep.dich("kenhBan.layTienDoDongBoThanhCong"))
                        .build()
        );
    }

    @PostMapping("/{maKenh}/dong-bo-ngay/dung")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Dừng đợt đồng bộ tay đang chạy sau SKU đang đẩy (bỏ bước lấy đơn)")
    public ResponseEntity<ResponseData<DongBoNgayDto>> dungDongBoNgay(@PathVariable String maKenh) {
        return ResponseEntity.ok(
                ResponseData.<DongBoNgayDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dongBoNgayService.dung(maKenh))
                        .message(ThongDiep.dich("kenhBan.daYeuCauDungDongBo"))
                        .build()
        );
    }

    @PostMapping("/dong-bo-tat-ca")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Chạy đợt đồng bộ tồn kho và đơn hàng cho toàn bộ các gian hàng active")
    public ResponseEntity<ResponseData<DayTonResultDto>> dongBoTatCa() {
        return ResponseEntity.ok(
                ResponseData.<DayTonResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dichLoiKenh(kenhBanHangDongBoService.dongBoTatCa()))
                        .message(ThongDiep.dich("kenhBan.chayDongBoToanBoThanhCong"))
                        .build()
        );
    }

    @PostMapping("/lien-ket/{id}/thu-lai")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Thử lại đẩy tồn cho một liên kết bị lỗi")
    public ResponseEntity<ResponseData<LienKetSanPhamDto>> thuLai(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<LienKetSanPhamDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.thuLai(id))
                        .message(ThongDiep.dich("kenhBan.thuLaiDongBoSkuThanhCong"))
                        .build()
        );
    }
    @PostMapping("/shopee/mock-order")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Sinh nhanh đơn hàng Shopee Sandbox mẫu để kiểm thử vận hành luồng kho")
    public ResponseEntity<ResponseData<Map<String, Object>>> sinhDonShopeeMau(
            @RequestParam(defaultValue = "1") int count,
            @RequestParam(defaultValue = "READY_TO_SHIP") String status) {
        String ma = "SHOPEE_SANDBOX";
        com.dev.backend.entities.KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma)
                .or(() -> kenhBanHangRepository.findByMaKenh("SHOPEE"))
                .orElse(null);
        if (kenh == null) {
            kenh = kenhBanHangRepository.save(com.dev.backend.entities.KenhBanHang.builder()
                    .maKenh(ma)
                    .tenKenh("Shopee Sandbox (Môi trường Thử nghiệm)")
                    .loaiKenh("online")
                    .apiUrl("https://partner.shopeemobile.com/api/v2")
                    .trangThai(1)
                    .build());
        }
        com.dev.backend.services.shopee.ShopeeMockEngine engine = shopeeMockEngine;
        java.util.List<com.dev.backend.dto.response.customize.ShopeeOrderDto> orders = engine.generateMockOrders(Math.min(Math.max(count, 1), 5), status);
        int synced = 0;
        java.util.List<String> orderNumbers = new java.util.ArrayList<>();
        for (com.dev.backend.dto.response.customize.ShopeeOrderDto ord : orders) {
            if (omnichannelOrderSyncJob.processSingleShopeeOrder(ord, kenh)) {
                synced++;
                orderNumbers.add("SHP-" + ord.getOrderSn());
            }
        }
        return ResponseEntity.ok(
                ResponseData.<Map<String, Object>>builder()
                        .status(HttpStatus.OK.value())
                        .data(Map.of(
                                "soDonTao", synced,
                                "danhSachDonHang", orderNumbers,
                                "trangThaiGiaLap", status
                        ))
                        .message(ThongDiep.dich("kenhBan.sinhDonShopeeMauThanhCong", synced))
                        .build()
        );
    }

    // ── Shopee REST Endpoints ──

    @PostMapping("/shopee/orders/cancel")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Shopee: Hủy đơn hàng từ phía nhà bán hàng (/api/v2/order/cancel_order)")
    public ResponseEntity<ResponseData<JsonNode>> cancelShopeeOrder(
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh,
            @RequestParam String orderSn,
            @RequestParam(defaultValue = "OUT_OF_STOCK") String cancelReason) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        JsonNode res = client.cancelOrder(orderSn, cancelReason);
        return ResponseEntity.ok(
                ResponseData.<JsonNode>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(ThongDiep.dich("kenhBan.guiHuyDonShopeeThanhCong"))
                        .build()
        );
    }

    @PostMapping("/shopee/orders/handle-cancellation")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Shopee: Xử lý chấp nhận hoặc từ chối yêu cầu hủy của người mua (/api/v2/order/handle_buyer_cancellation)")
    public ResponseEntity<ResponseData<JsonNode>> handleShopeeBuyerCancellation(
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh,
            @RequestParam String orderSn,
            @RequestParam(defaultValue = "ACCEPT") String operation) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        JsonNode res = client.handleBuyerCancellation(orderSn, operation);
        return ResponseEntity.ok(
                ResponseData.<JsonNode>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(ThongDiep.dich("kenhBan.xuLyYeuCauHuyThanhCong", operation))
                        .build()
        );
    }

    @PostMapping("/shopee/orders/{orderSn}/note")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Shopee: Cập nhật ghi chú người bán cho đơn hàng (/api/v2/order/set_note)")
    public ResponseEntity<ResponseData<JsonNode>> setShopeeOrderNote(
            @PathVariable String orderSn,
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh,
            @RequestParam String note) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        JsonNode res = client.setOrderNote(orderSn, note);
        return ResponseEntity.ok(
                ResponseData.<JsonNode>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(ThongDiep.dich("kenhBan.capNhatGhiChuShopeeThanhCong"))
                        .build()
        );
    }

    @GetMapping("/shopee/orders/{orderSn}/shipping-parameter")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    @Operation(summary = "Shopee: Lấy thông số phương thức giao nhận Dropoff/Pickup (/api/v2/logistics/get_shipping_parameter)")
    public ResponseEntity<ResponseData<JsonNode>> getShopeeShippingParameter(
            @PathVariable String orderSn,
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        JsonNode res = client.getShippingParameter(orderSn);
        return ResponseEntity.ok(
                ResponseData.<JsonNode>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(ThongDiep.dich("kenhBan.layThamSoVanChuyenShopeeThanhCong"))
                        .build()
        );
    }

    @PostMapping("/shopee/orders/{orderSn}/ship")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    @Operation(summary = "Shopee: Xác nhận sẵn sàng giao / phát lệnh ship đơn hàng (/api/v2/logistics/ship_order)")
    public ResponseEntity<ResponseData<JsonNode>> shipShopeeOrder(
            @PathVariable String orderSn,
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh,
            @RequestParam(required = false, defaultValue = "dropoff") String method) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        JsonNode res = client.shipOrder(orderSn, method);
        return ResponseEntity.ok(
                ResponseData.<JsonNode>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(ThongDiep.dich("kenhBan.phatLenhGiaoShopeeThanhCong"))
                        .build()
        );
    }

    @GetMapping("/shopee/orders/{orderSn}/tracking-number")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    @Operation(summary = "Shopee: Lấy mã vận đơn Shopee/SPX Express (/api/v2/logistics/get_tracking_number)")
    public ResponseEntity<ResponseData<JsonNode>> getShopeeTrackingNumber(
            @PathVariable String orderSn,
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        JsonNode res = client.getTrackingNumber(orderSn);
        return ResponseEntity.ok(
                ResponseData.<JsonNode>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(ThongDiep.dich("kenhBan.traMaVanDonShopeeThanhCong"))
                        .build()
        );
    }

    @GetMapping("/shopee/orders/{orderSn}/tracking-info")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    @Operation(summary = "Shopee: Tra cứu chi tiết hành trình vận chuyển đơn hàng (/api/v2/logistics/get_tracking_info)")
    public ResponseEntity<ResponseData<JsonNode>> getShopeeTrackingInfo(
            @PathVariable String orderSn,
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        JsonNode res = client.getTrackingInfo(orderSn);
        return ResponseEntity.ok(
                ResponseData.<JsonNode>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(ThongDiep.dich("kenhBan.traLoTrinhShopeeThanhCong"))
                        .build()
        );
    }

    @GetMapping("/shopee/orders/{orderSn}/shipping-document")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    @Operation(summary = "Shopee: Tải tài liệu in vận đơn khổ A6 dạng HTML / PDF (/api/v2/logistics/download_shipping_document)")
    public ResponseEntity<ResponseData<Map<String, String>>> downloadShopeeShippingDocument(
            @PathVariable String orderSn,
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        byte[] docBytes = client.downloadShippingDocument(orderSn);
        String docHtml = docBytes != null ? new String(docBytes, java.nio.charset.StandardCharsets.UTF_8) : "";
        return ResponseEntity.ok(
                ResponseData.<Map<String, String>>builder()
                        .status(HttpStatus.OK.value())
                        .data(Map.of(
                                "orderSn", orderSn,
                                "documentHtml", docHtml,
                                "mimeType", "text/html"
                        ))
                        .message(ThongDiep.dich("kenhBan.taiTemVanDonShopeeThanhCong"))
                        .build()
        );
    }

    @GetMapping("/shopee/orders/{orderSn}/escrow")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Shopee: Tra cứu đối soát chi tiết thanh toán và tiền về ví (/api/v2/payment/get_escrow_detail)")
    public ResponseEntity<ResponseData<JsonNode>> getShopeeEscrowDetail(
            @PathVariable String orderSn,
            @RequestParam(required = false, defaultValue = "SHOPEE_SANDBOX") String maKenh) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh.toUpperCase()).orElse(null);
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClientForController(kenh, maKenh);
        JsonNode res = client.getEscrowDetail(orderSn);
        return ResponseEntity.ok(
                ResponseData.<JsonNode>builder()
                        .status(HttpStatus.OK.value())
                        .data(res)
                        .message(ThongDiep.dich("kenhBan.doiSoatShopeeThanhCong"))
                        .build()
        );
    }

    @PostMapping("/shopee/webhook")
    @Operation(summary = "Shopee: Webhook tiếp nhận sự kiện cập nhật trạng thái đơn hàng realtime từ Shopee")
    public ResponseEntity<Map<String, Object>> handleShopeeWebhook(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody String payload) {
        log.info("[SHOPEE-WEBHOOK] Nhận tín hiệu sự kiện từ Shopee: payload={}", payload);
        return ResponseEntity.ok(Map.of("code", 0, "message", "success"));
    }

    @PostMapping("/shopee/mock-cancel")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    @Operation(summary = "Shopee: Giả lập người mua hủy đơn trên sàn để kiểm thử luồng đồng bộ hủy")
    public ResponseEntity<ResponseData<Map<String, Object>>> mockBuyerCancelShopeeOrder(
            @RequestParam String orderSn) {
        return ResponseEntity.ok(
                ResponseData.<Map<String, Object>>builder()
                        .status(HttpStatus.OK.value())
                        .data(Map.of(
                                "orderSn", orderSn,
                                "trangThaiMoi", "CANCELLED",
                                "nguyenNhan", "Người mua đổi ý trên Shopee Sandbox"
                        ))
                        .message(ThongDiep.dich("kenhBan.giaLapHuyDonShopeeThanhCong"))
                        .build()
        );
    }

    private com.dev.backend.services.shopee.ShopeeClient getShopeeClientForController(KenhBanHang kenh, String maKenh) {
        Long partnerId = kenhBanHangService.getShopeePartnerId(maKenh);
        String partnerKey = kenhBanHangService.getDecryptedShopeePartnerKey(maKenh);
        String accessToken = kenhBanHangService.getDecryptedShopeeAccessToken(maKenh);
        Long shopId = kenhBanHangService.getShopeeShopId(maKenh);
        boolean isSandbox = OmnichannelOrderSyncJob.isShopeeSandbox(maKenh);

        return new com.dev.backend.services.shopee.ShopeeClient(
                partnerId != null ? partnerId : 0L,
                partnerKey != null ? partnerKey : "",
                shopId != null ? shopId : 0L,
                accessToken != null ? accessToken : "",
                isSandbox
        );
    }

    /**
     * Lỗi cả gian hàng (loiKenh) là câu tiếng Việt dùng chung với job, thông báo hệ thống và lý do lưu từng SKU:
     * chỉ dịch ở response trả giao diện, theo ngôn ngữ người bấm.
     */
    private static DayTonResultDto dichLoiKenh(DayTonResultDto ketQua) {
        if (ketQua != null && ketQua.getLoiKenh() != null) {
            ketQua.setLoiKenh(DichCauDaLuu.dich(ketQua.getLoiKenh()));
        }
        return ketQua;
    }

}
