package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.omnichannel.ApplySyncRecommendationsRequest;
import com.dev.backend.dto.omnichannel.OmnichannelAnalyticsOverviewDto;
import com.dev.backend.dto.omnichannel.OmnichannelSyncRecommendationDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.services.omnichannel.OmnichannelAnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller Màn 2 (DSS Báo cáo Đồng bộ Kênh — URL FE: /channels/analytics).
 * Cung cấp 3 REST API: xem sức khỏe API/Oversell 4 sàn, tính đề xuất Buffer% & Threshold_RT và lưu cấu hình áp dụng.
 */
@RestController
@RequestMapping("/api/v1/omnichannel/analytics")
@Tag(name = "Phân tích đồng bộ đa kênh", description = "Telemetry hiệu năng API sàn TMĐT, Leaky Bucket, khuyến nghị Buffer% và Threshold_RT")
public class OmnichannelAnalyticsController {

    private final OmnichannelAnalyticsService analyticsService;

    public OmnichannelAnalyticsController(OmnichannelAnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    // API 1 (Tab Overview): Đọc log telemetry `lich_su_dong_bo_metric`, rate limit RAM & thống kê đơn hủy thiếu hàng (Oversell)
    @GetMapping("/overview")
    @Operation(summary = "Tổng quan chỉ số hiệu năng tích hợp sàn TMĐT (METRIC_01..06)")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<OmnichannelAnalyticsOverviewDto>> getOverview(
            @RequestParam(defaultValue = "24h") String range,
            @RequestParam(required = false) String channel) {
        return ResponseEntity.ok(ResponseData.<OmnichannelAnalyticsOverviewDto>builder()
                .status(HttpStatus.OK.value())
                .data(analyticsService.getOverview(range, channel))
                .message("Success")
                .build());
    }

    // API 2 (Tab Đề xuất): Tính tỷ trọng bán tại quầy r_POS theo từng SKU và gợi ý Buffer% + ngưỡng đẩy khẩn cấp
    @GetMapping("/sync-recommendations")
    @Operation(summary = "Tính toán tỷ trọng bán tại quầy r_POS,k và khuyến nghị Buffer% / Threshold_RT theo SKU")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<OmnichannelSyncRecommendationDto>> getSyncRecommendations(
            @RequestParam(defaultValue = "14") Integer days,
            @RequestParam(required = false) String channel) {
        return ResponseEntity.ok(ResponseData.<OmnichannelSyncRecommendationDto>builder()
                .status(HttpStatus.OK.value())
                .data(analyticsService.getSyncRecommendations(days, channel))
                .message("Success")
                .build());
    }

    // API 3 (Nút "Áp dụng đề xuất" — chỉ Quản trị viên): Ghi Buffer% & Threshold_RT xuống bảng `trang_thai_dong_bo_san_pham`
    @PostMapping("/apply-recommendations")
    @Operation(summary = "Áp dụng Buffer% và Threshold_RT khuyến nghị vào cấu hình đẩy tồn của các SKU liên kết sàn")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<Integer>> applyRecommendations(
            @RequestBody ApplySyncRecommendationsRequest request) {
        int updated = analyticsService.applyRecommendations(request);
        return ResponseEntity.ok(ResponseData.<Integer>builder()
                .status(HttpStatus.OK.value())
                .data(updated)
                .message(ThongDiep.dich("dss.daApDungKhuyenNghiDongBo", updated))
                .build());
    }
}

