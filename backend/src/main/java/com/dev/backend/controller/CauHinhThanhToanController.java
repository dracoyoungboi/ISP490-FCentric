package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.PayosConfigUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.PayosConfigDto;
import com.dev.backend.dto.response.customize.PayosTestResult;
import com.dev.backend.services.impl.payos.PaymentConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Cài đặt → Thanh toán (chỉ quản trị viên). Không API nào trả khóa thật về client. */
@RestController
@RequestMapping("/api/v1/cau-hinh-thanh-toan/payos")
public class CauHinhThanhToanController {

    private final PaymentConfigService service;

    public CauHinhThanhToanController(PaymentConfigService service) {
        this.service = service;
    }

    @GetMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<PayosConfigDto>> get() {
        return ok(service.getPayos(), "Success");
    }

    @PutMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<PayosConfigDto>> update(@RequestBody PayosConfigUpdating request) {
        return ok(service.updatePayos(request), "Đã lưu cấu hình payOS");
    }

    @PostMapping("/kiem-tra-ket-noi")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<PayosTestResult>> test() {
        PayosTestResult result = service.testConnection();
        return ok(result, result.getMessage());
    }

    @PostMapping("/dang-ky-webhook")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<PayosConfigDto>> confirmWebhook(@RequestBody(required = false) Map<String, String> body) {
        return ok(service.confirmWebhook(body == null ? null : body.get("webhookUrl")), "payOS đã xác nhận webhook");
    }

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String message) {
        return ResponseEntity.ok(ResponseData.<T>builder().status(200).data(data).message(message).error(null).build());
    }
}
