package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.dss.DssConfigUpdateRequest;
import com.dev.backend.dto.dss.DssReplenishmentResponse;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.DssReplenishmentRepository.KhoInfo;
import com.dev.backend.services.impl.dss.DssReplenishmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dss/replenishment")
@Tag(name = "DSS Nhập hàng", description = "Thuật toán trích xuất biến số động, kịch bản nhập hàng & điểm đặt hàng lại (ROP)")
public class DssReplenishmentController {

    private final DssReplenishmentService dssReplenishmentService;

    public DssReplenishmentController(DssReplenishmentService dssReplenishmentService) {
        this.dssReplenishmentService = dssReplenishmentService;
    }

    @GetMapping("/warehouses")
    @Operation(summary = "Danh sách kho đang hoạt động cho màn DSS")
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<List<KhoInfo>>> getWarehouses() {
        return ResponseEntity.ok(ResponseData.<List<KhoInfo>>builder()
                .status(HttpStatus.OK.value())
                .data(dssReplenishmentService.listWarehouses())
                .message("Success")
                .build());
    }

    @GetMapping("/recommendations")
    @Operation(summary = "Tính toán và lấy danh sách đề xuất bổ sung hàng trên tổng tất cả kho đang hoạt động (SS, ROP, Q, DOI, Urgency, ABC)")
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<DssReplenishmentResponse>> getRecommendations(
            @RequestParam(required = false) Integer khoId) {
        return ResponseEntity.ok(ResponseData.<DssReplenishmentResponse>builder()
                .status(HttpStatus.OK.value())
                .data(dssReplenishmentService.getRecommendations(khoId))
                .message("Success")
                .build());
    }

    @PutMapping("/config")
    @Operation(summary = "Cập nhật tham số và kịch bản DSS rồi đồng bộ lại ngưỡng ROP toàn hệ thống")
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<DssReplenishmentResponse>> updateConfig(
            @RequestBody DssConfigUpdateRequest request) {
        return ResponseEntity.ok(ResponseData.<DssReplenishmentResponse>builder()
                .status(HttpStatus.OK.value())
                .data(dssReplenishmentService.updateConfig(request))
                .message(ThongDiep.dich("dss.daCapNhatCauHinhVaTinhLai"))
                .build());
    }

    @PostMapping("/recalculate")
    @Operation(summary = "Tính toán lại theo thời gian thực trên tổng tất cả kho hoạt động và đồng bộ ngưỡng cảnh báo vào bảng canh_bao")
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<DssReplenishmentResponse>> recalculate(
            @RequestParam(required = false) Integer khoId) {
        return ResponseEntity.ok(ResponseData.<DssReplenishmentResponse>builder()
                .status(HttpStatus.OK.value())
                .data(dssReplenishmentService.recalculateAndSyncAlerts(khoId))
                .message(ThongDiep.dich("dss.daCapNhatCauHinhVaTinhLai"))
                .build());
    }
}

