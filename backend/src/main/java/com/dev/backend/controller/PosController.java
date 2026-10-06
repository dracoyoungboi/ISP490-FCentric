package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.PosCatalogItemDto;
import com.dev.backend.dto.response.customize.PosCheckoutRecoveryResponse;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.impl.entities.PosCatalogService;
import com.dev.backend.services.impl.entities.PosCheckoutService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API POS: catalog/tra cứu (Phase 02) + checkout tiền mặt & phục hồi (Phase 03).
 * Checkout bị khóa bởi config `pos.checkout-enabled=false` (mặc định tắt) cho tới
 * khi nghiệm thu — không gọi lại API báo giá/xuất kho cũ để mô phỏng checkout.
 */
@RestController
@RequestMapping("/api/v1/pos")
public class PosController {

    @Autowired
    private PosCatalogService posCatalogService;

    @Autowired
    private PosCheckoutService posCheckoutService;

    /** Gate server-side: mặc định TẮT; chỉ bật khi triển khai có chủ đích. */
    @Value("${pos.checkout-enabled:false}")
    private boolean checkoutEnabled;

    /**
     * Catalog SKU bán được của một kho được ủy quyền, phân trang server-side.
     * khoId bắt buộc; service kiểm tra quyền kho server-side (admin bỏ qua).
     */
    @GetMapping("/catalog")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<PosCatalogItemDto>>> getCatalog(
            @RequestParam Integer khoId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "120") int size
    ) {
        return ResponseEntity.ok(
                ResponseData.<Page<PosCatalogItemDto>>builder()
                        .status(200)
                        .data(posCatalogService.getCatalog(khoId, q, page, size))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /**
     * Tra cứu phím tắt Enter (skuPrefix — chỉ khớp mã SKU/mã vạch SKU bắt đầu bằng từ khóa,
     * kết quả đầu tiên của toàn bộ truy vấn server-side) hoặc quét mã vạch (barcode — khớp
     * CHÍNH XÁC; nhiều kết quả là nhập nhằng, client không được tự chọn).
     */
    @GetMapping("/lookup")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<PosCatalogItemDto>>> lookup(
            @RequestParam Integer khoId,
            @RequestParam(required = false) String skuPrefix,
            @RequestParam(required = false) String barcode
    ) {
        return ResponseEntity.ok(
                ResponseData.<List<PosCatalogItemDto>>builder()
                        .status(200)
                        .data(posCatalogService.lookup(khoId, skuPrefix, barcode))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /**
     * Checkout POS tiền mặt (Phase 03). Idempotency: requestId do client sinh,
     * giữ nguyên khi retry sau timeout; server chặn race bằng unique constraint.
     * Trả 409 có cấu trúc (data.priceChanged) khi giá hiển thị đã đổi.
     */
    @PostMapping("/checkout")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<PosCheckoutResponse>> checkout(
            @RequestBody PosCheckoutCreating request
    ) {
        if (!checkoutEnabled) {
            throw new CommonException(
                    "Chức năng thanh toán POS chưa được kích hoạt trên hệ thống",
                    HttpStatus.SERVICE_UNAVAILABLE,
                    null);
        }
        return ResponseEntity.ok(
                ResponseData.<PosCheckoutResponse>builder()
                        .status(200)
                        .data(posCheckoutService.checkout(request))
                        .message("Thanh toán thành công")
                        .error(null)
                        .build()
        );
    }

    /**
     * Phục hồi kết quả checkout khi client mất phản hồi. Chỉ chủ sở hữu (thu ngân
     * tạo), admin hoặc người có quyền kho của giao dịch được xem — không đoán id
     * của người khác. Không tìm thấy = kết quả chưa rõ (được phép thử lại cùng key).
     */
    @GetMapping("/checkout-requests/{requestId}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.quan_ly_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<PosCheckoutRecoveryResponse>> getCheckoutRequest(
            @PathVariable String requestId
    ) {
        return ResponseEntity.ok(
                ResponseData.<PosCheckoutRecoveryResponse>builder()
                        .status(200)
                        .data(posCheckoutService.getCheckoutRequest(requestId))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }
}
