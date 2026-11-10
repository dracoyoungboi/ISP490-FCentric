package com.dev.backend.controller;

import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.entities.ShopeeMockOrder;
import com.dev.backend.entities.ShopeeMockProduct;
import com.dev.backend.services.shopee.ShopeeMockEngine;
import lombok.AccessLevel;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API phục vụ Cổng Giả Lập Shopee Interactive Sandbox (/shopee-simulator).
 * Hỗ trợ giao diện Kênh Người Mua (Storefront) và Kênh Người Bán (Seller Center).
 */
@RestController
@RequestMapping("/api/v1/shopee-mock")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ShopeeMockController {

    ShopeeMockEngine mockEngine;

    // =========================================================================
    // 1. KÊNH NGƯỜI MUA (SHOPEE BUYER STOREFRONT)
    // =========================================================================

    /**
     * Lấy danh sách sản phẩm thời trang đang bán trên sàn Shopee Mall.
     */
    @GetMapping("/storefront/products")
    public ResponseData<List<Map<String, Object>>> getStorefrontProducts() {
        return ResponseData.<List<Map<String, Object>>>builder()
                .status(HttpStatus.OK.value())
                .message(ThongDiep.dich("kenhBan.layDsSanPhamStorefrontThanhCong"))
                .data(mockEngine.getStorefrontProducts())
                .build();
    }

    /**
     * Đặt mua hàng từ giao diện Shopee Buyer.
     */
    @PostMapping("/storefront/checkout")
    public ResponseData<ShopeeMockOrder> buyerCheckout(@RequestBody BuyerCheckoutRequest req) {
        if (req.getItemId() == null || req.getModelId() == null) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.thieuItemIdModelId"));
        }
        int qty = req.getQuantity() != null && req.getQuantity() > 0 ? req.getQuantity() : 1;

        ShopeeMockOrder order = mockEngine.buyerCheckout(
                req.getItemId(),
                req.getModelId(),
                qty,
                req.getBuyerName(),
                req.getBuyerPhone(),
                req.getShippingAddress(),
                req.getPaymentMethod()
        );

        return ResponseData.<ShopeeMockOrder>builder()
                .status(HttpStatus.CREATED.value())
                .message(ThongDiep.dich("kenhBan.datHangShopeeMallThanhCong", order.getOrderSn()))
                .data(order)
                .build();
    }

    // =========================================================================
    // 2. KÊNH NGƯỜI BÁN (SHOPEE SELLER CENTER)
    // =========================================================================

    /**
     * Lấy danh sách sản phẩm và số lượng tồn kho hiện hành trên sàn Shopee Seller Center.
     */
    @GetMapping("/seller/products")
    public ResponseData<List<ShopeeMockProduct>> getSellerProducts() {
        return ResponseData.<List<ShopeeMockProduct>>builder()
                .status(HttpStatus.OK.value())
                .message(ThongDiep.dich("kenhBan.layDsSanPhamSellerCenterThanhCong"))
                .data(mockEngine.getSellerProducts())
                .build();
    }

    /**
     * Lấy danh sách đơn hàng sàn trên Shopee Seller Center.
     */
    @GetMapping("/seller/orders")
    public ResponseData<List<ShopeeMockOrder>> getSellerOrders() {
        return ResponseData.<List<ShopeeMockOrder>>builder()
                .status(HttpStatus.OK.value())
                .message(ThongDiep.dich("kenhBan.layDsDonSellerCenterThanhCong"))
                .data(mockEngine.getSellerOrders())
                .build();
    }

    /**
     * Cập nhật trạng thái đơn hàng sàn (Hủy đơn, Giao hàng, Hoàn tất).
     */
    @PostMapping("/seller/orders/{orderSn}/status")
    public ResponseData<ShopeeMockOrder> updateOrderStatus(
            @PathVariable String orderSn,
            @RequestBody UpdateOrderStatusRequest req) {
        ShopeeMockOrder updated = mockEngine.updateOrderStatus(
                orderSn,
                req.getStatus(),
                req.getCancelReason(),
                req.getCancelUser()
        );
        return ResponseData.<ShopeeMockOrder>builder()
                .status(HttpStatus.OK.value())
                .message(ThongDiep.dich("kenhBan.capNhatTrangThaiDonMock", orderSn, req.getStatus()))
                .data(updated)
                .build();
    }

    /**
     * Đặt lại toàn bộ dữ liệu sàn Shopee Sandbox về mặc định.
     */
    @PostMapping("/reset")
    public ResponseData<String> resetData() {
        mockEngine.resetSandboxData();
        return ResponseData.<String>builder()
                .status(HttpStatus.OK.value())
                .message(ThongDiep.dich("kenhBan.datLaiDuLieuShopeeSandboxThanhCong"))
                .data("OK")
                .build();
    }

    // =========================================================================
    // 3. QUẢN LÝ ỦY QUYỀN ỨNG DỤNG ĐỐI TÁC (APP AUTHORIZATION MANAGEMENT)
    // =========================================================================

    /**
     * Lấy trạng thái ủy quyền hiện tại của Ứng dụng FCentric trên gian hàng Shopee.
     */
    @GetMapping("/app-auth")
    public ResponseData<Map<String, Object>> getAppAuthStatus() {
        return ResponseData.<Map<String, Object>>builder()
                .status(HttpStatus.OK.value())
                .message(ThongDiep.dich("kenhBan.layUyQuyenUngDungThanhCong"))
                .data(mockEngine.getAppAuthStatus())
                .build();
    }

    /**
     * Hủy ủy quyền ứng dụng FCentric từ Kênh Người Bán Shopee (Deauthorize / Revoke).
     */
    @PostMapping("/app-auth/revoke")
    public ResponseData<Boolean> revokeAppAuth() {
        boolean ok = mockEngine.revokeAppAuth();
        return ResponseData.<Boolean>builder()
                .status(HttpStatus.OK.value())
                .message(ok ? ThongDiep.dich("kenhBan.huyUyQuyenUngDungThanhCong") : ThongDiep.dich("kenhBan.gianHangChuaUyQuyen"))
                .data(ok)
                .build();
    }

    // =========================================================================
    // DTO REQUEST
    // =========================================================================

    @Data
    public static class BuyerCheckoutRequest {
        Long itemId;
        Long modelId;
        Integer quantity;
        String buyerName;
        String buyerPhone;
        String shippingAddress;
        String paymentMethod;
    }

    @Data
    public static class UpdateOrderStatusRequest {
        String status;
        String cancelReason;
        String cancelUser;
    }
}
