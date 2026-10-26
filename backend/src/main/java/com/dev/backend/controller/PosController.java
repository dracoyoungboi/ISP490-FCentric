package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.PosCatalogNhomDto;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.request.PosQuickCustomerCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.PosCatalogItemDto;
import com.dev.backend.dto.response.customize.PosCheckoutRecoveryResponse;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.dto.response.customize.PayosPaymentLinkDto;
import com.dev.backend.dto.response.customize.PosPayosGiaoDichDto;
import com.dev.backend.services.impl.payos.PosPayosService;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.impl.entities.PosCatalogService;
import com.dev.backend.services.impl.entities.PosCheckoutService;
import com.dev.backend.services.impl.entities.KhachHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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

    @Autowired
    private KhachHangService khachHangService;

    @Autowired
    private PosPayosService posPayosService;

    /** Gate server-side: mặc định TẮT; chỉ bật khi triển khai có chủ đích. */
    @Value("${pos.checkout-enabled:false}")
    private boolean checkoutEnabled;

    /**
     * Catalog SKU bán được của một kho được ủy quyền, phân trang server-side.
     * khoId bắt buộc; service kiểm tra quyền kho server-side (admin bỏ qua).
     * Bộ lọc tùy chọn: trangThaiTon = con_hang | het_hang | tat_ca (mặc định tat_ca).
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
            @RequestParam(required = false) String trangThaiTon,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "120") int size
    ) {
        return ResponseEntity.ok(
                ResponseData.<Page<PosCatalogItemDto>>builder()
                        .status(200)
                        .data(posCatalogService.getCatalog(khoId, q, trangThaiTon, page, size))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /**
     * Danh mục POS GỘP KÍCH CỠ: mỗi phần tử là một mẫu + màu (+ chất liệu) kèm đủ các kích cỡ,
     * tồn khả dụng và giá của từng kích cỡ. Phân trang và bộ lọc tồn tính theo nhóm
     * (con_hang = còn ít nhất một kích cỡ có hàng; het_hang = mọi kích cỡ đều hết; tat_ca).
     * Cùng kiểm tra quyền kho như /catalog. /catalog (từng SKU) vẫn giữ cho client cũ.
     */
    @GetMapping("/catalog/groups")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<PosCatalogNhomDto>>> getCatalogGroups(
            @RequestParam Integer khoId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String trangThaiTon,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "60") int size
    ) {
        return ResponseEntity.ok(
                ResponseData.<Page<PosCatalogNhomDto>>builder()
                        .status(200)
                        .data(posCatalogService.getCatalogNhom(khoId, q, trangThaiTon, page, size))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /**
     * Tồn khả dụng hiện tại của các SKU trong giỏ tại kho đang bán (ids=1,2,3).
     * Giúp màn POS cập nhật "Chỉ còn N"/hết hàng cho dòng giỏ không nằm trong trang catalog
     * đang xem (ví dụ đang lọc "Còn hàng"). Cùng kiểm tra quyền kho như catalog.
     */
    @GetMapping("/stock")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Map<Integer, BigDecimal>>> getStock(
            @RequestParam Integer khoId,
            @RequestParam List<Integer> ids
    ) {
        return ResponseEntity.ok(
                ResponseData.<Map<Integer, BigDecimal>>builder()
                        .status(200)
                        .data(posCatalogService.getAvailableStock(khoId, ids))
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
                    IRoleType.quan_ly_kho,
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
        if (request != null && request.getKhoId() == null) {
            Integer currentKhoId = com.dev.backend.config.SecurityContextHolder.getKhoId();
            if (currentKhoId != null) {
                request.setKhoId(currentKhoId);
            }
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

    /** Phương thức thanh toán đang bật ở quầy: {cash: true, payos: true/false}. */
    @GetMapping("/payment-methods")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Map<String, Boolean>>> paymentMethods() {
        return ResponseEntity.ok(ResponseData.<Map<String, Boolean>>builder()
                .status(200).data(posPayosService.paymentMethods()).message("Success").error(null).build());
    }

    /**
     * Chuyển khoản payOS: giữ chỗ hàng + tạo mã QR. Body giống checkout tiền mặt
     * (requestId, khoId, khachHangId, items, note); phần payment bị bỏ qua.
     */
    @PostMapping("/payos/payment-links")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<PayosPaymentLinkDto>> createPayosLink(@RequestBody PosCheckoutCreating request) {
        if (!checkoutEnabled) {
            throw new CommonException("Chức năng thanh toán POS chưa được kích hoạt trên hệ thống",
                    HttpStatus.SERVICE_UNAVAILABLE, null);
        }
        if (request != null && request.getKhoId() == null) {
            Integer currentKhoId = com.dev.backend.config.SecurityContextHolder.getKhoId();
            if (currentKhoId != null) {
                request.setKhoId(currentKhoId);
            }
        }
        return ResponseEntity.ok(ResponseData.<PayosPaymentLinkDto>builder()
                .status(200).data(posPayosService.createLink(request)).message("Đã tạo mã QR").error(null).build());
    }

    /** Trạng thái giao dịch chuyển khoản (màn POS hỏi mỗi vài giây). PAID -> kèm kết quả đơn. */
    @GetMapping("/payos/payment-links/{orderCode}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.quan_ly_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<PayosPaymentLinkDto>> getPayosLink(@PathVariable Long orderCode) {
        return ResponseEntity.ok(ResponseData.<PayosPaymentLinkDto>builder()
                .status(200).data(posPayosService.getStatus(orderCode)).message("Success").error(null).build());
    }

    /** Hủy mã QR, trả lại hàng giữ chỗ (nếu khách đã kịp trả thì hoàn tất đơn thay vì hủy). */
    @PostMapping("/payos/payment-links/{orderCode}/cancel")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<PayosPaymentLinkDto>> cancelPayosLink(@PathVariable Long orderCode) {
        return ResponseEntity.ok(ResponseData.<PayosPaymentLinkDto>builder()
                .status(200).data(posPayosService.cancel(orderCode)).message("Đã hủy mã QR").error(null).build());
    }

    /**
     * Màn quản lý "Đối soát chuyển khoản": danh sách giao dịch payOS (mới nhất trước), kèm tài khoản người chuyển
     * (thông tin cá nhân — chỉ quản trị viên). trangThai = PAID_ERROR: đã nhận tiền nhưng chưa có đơn, cần xử lý;
     * daXuLy = true: chỉ giao dịch quản lý đã xử lý.
     */
    @GetMapping("/payos/payment-links")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<Page<PosPayosGiaoDichDto>>> listPayosTransactions(
            @RequestParam(required = false) String trangThai,
            @RequestParam(defaultValue = "false") boolean daXuLy,
            @RequestParam(required = false) Integer khoId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate tuNgay,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate denNgay,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ResponseData.<Page<PosPayosGiaoDichDto>>builder()
                .status(200).data(posPayosService.listTransactions(trangThai, daXuLy, khoId, tuNgay, denNgay, page, size))
                .message("Success").error(null).build());
    }

    /** Số giao dịch đã nhận tiền nhưng chưa có đơn (số đếm trên menu). */
    @GetMapping("/payos/payment-links/needs-attention-count")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<Long>> countPayosNeedsAttention() {
        return ResponseEntity.ok(ResponseData.<Long>builder()
                .status(200).data(posPayosService.countNeedsAttention()).message("Success").error(null).build());
    }

    /** Giao dịch lỗi -> tạo đơn bán (đã nhận đủ tiền, còn hàng). Body: {"ghiChu": "..."} (không bắt buộc). */
    @PostMapping("/payos/payment-links/{orderCode}/create-order")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<PosPayosGiaoDichDto>> createOrderFromPaidError(
            @PathVariable Long orderCode, @RequestBody(required = false) Map<String, String> body) {
        String ghiChu = body == null ? null : body.get("ghiChu");
        return ResponseEntity.ok(ResponseData.<PosPayosGiaoDichDto>builder()
                .status(200).data(posPayosService.createOrderFromPaidError(orderCode, ghiChu))
                .message("Đã tạo đơn bán").error(null).build());
    }

    /** Giao dịch lỗi -> đã hoàn tiền cho khách (trả hàng giữ chỗ). Body: {"ghiChu": "..."} (bắt buộc). */
    @PostMapping("/payos/payment-links/{orderCode}/refunded")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<PosPayosGiaoDichDto>> markPayosRefunded(
            @PathVariable Long orderCode, @RequestBody(required = false) Map<String, String> body) {
        String ghiChu = body == null ? null : body.get("ghiChu");
        return ResponseEntity.ok(ResponseData.<PosPayosGiaoDichDto>builder()
                .status(200).data(posPayosService.markRefunded(orderCode, ghiChu))
                .message("Đã ghi nhận hoàn tiền").error(null).build());
    }

    /**
     * Tìm khách hàng đang hoạt động cho hộp chọn khách của màn POS (theo tên / SĐT / mã),
     * phân trang server-side; Khách lẻ đứng đầu, khách mới thêm kế tiếp.
     */
    @GetMapping("/customers")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<KhachHangDto>>> searchCustomers(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(
                ResponseData.<Page<KhachHangDto>>builder()
                        .status(200)
                        .data(khachHangService.searchActiveForPos(q, page, size))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /**
     * Thêm nhanh khách hàng tại quầy (tên + SĐT). Trả về khách vừa tạo để chọn ngay
     * vào hóa đơn. SĐT trùng -> 409 kèm khách hàng hiện có.
     */
    @PostMapping("/customers")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<KhachHangDto>> quickCreateCustomer(
            @RequestBody PosQuickCustomerCreating request
    ) {
        return ResponseEntity.ok(
                ResponseData.<KhachHangDto>builder()
                        .status(200)
                        .data(khachHangService.quickCreateForPos(request))
                        .message("Đã thêm khách hàng")
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
