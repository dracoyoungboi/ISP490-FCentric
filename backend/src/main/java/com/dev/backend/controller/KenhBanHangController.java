package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
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
public class KenhBanHangController {

    KenhBanHangService kenhBanHangService;
    KenhBanHangDongBoService kenhBanHangDongBoService;

    @GetMapping("/shopify")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Lấy thông tin cấu hình kênh bán Shopify (Token đã mask an toàn)")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> getShopifyConfig() {
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getShopifyConfig())
                        .message("Lấy cấu hình kênh bán Shopify thành công")
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
                        .message("Cập nhật cấu hình Shopify thành công")
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
                        .message(res.isConnected() ? "Kết nối Shopify thành công" : "Kiểm tra kết nối thất bại")
                        .build()
        );
    }

    @PostMapping("/shopify/refresh-token")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @Operation(summary = "Chủ động làm mới Access Token OAuth 2.0 của Shopify bằng Refresh Token")
    public ResponseEntity<ResponseData<ShopifyConfigResponse>> refreshShopifyOAuthToken() {
        boolean success = kenhBanHangService.refreshShopifyAccessToken();
        return ResponseEntity.ok(
                ResponseData.<ShopifyConfigResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangService.getShopifyConfig())
                        .message(success ? "Làm mới Access Token OAuth 2.0 thành công" : "Không thể làm mới token")
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
                        .message("Tải sản phẩm từ kênh thành công")
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
                        .message("Tự động liên kết SKU thành công")
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
                        .message("Lấy danh sách liên kết thành công")
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
                        .message("Cập nhật liên kết thành công")
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
        return ResponseEntity.ok(
                ResponseData.<DayTonResultDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(kenhBanHangDongBoService.dayTonKhoLenKenh(maKenh, request))
                        .message("Đẩy tồn kho lên kênh bán thành công")
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
                        .message("Lấy thông tin tổng quan đồng bộ thành công")
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
                        .message("Lấy thông tin tổng quan hệ thống thành công")
                        .build()
        );
    }
}
