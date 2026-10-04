package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.ActiveTemplateRequest;
import com.dev.backend.dto.request.MigratePrintConfigsRequest;
import com.dev.backend.dto.request.PrintTemplateConfigRequest;
import com.dev.backend.dto.response.PrintConfigBundleDto;
import com.dev.backend.dto.response.PrintTemplateConfigDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.entities.MauInDangApDung;
import com.dev.backend.services.impl.entities.CauHinhMauInService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * API cấu hình mẫu in + mẫu đang áp dụng (nguồn sự thật của luồng in thật).
 * - ĐỌC: mọi tài khoản nội bộ (là người in phiếu) đều đọc được.
 * - GHI: chỉ quan_tri_vien / quan_ly_kho (khớp vai trò cấu hình hiện tại).
 */
@RestController
@RequestMapping("/api/v1/cau-hinh-mau-in")
public class CauHinhMauInController {

    @Autowired
    private CauHinhMauInService cauHinhMauInService;

    @GetMapping
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<PrintConfigBundleDto>> getBundle() {
        return ResponseEntity.ok(
                ResponseData.<PrintConfigBundleDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(cauHinhMauInService.getBundle())
                        .build()
        );
    }

    @GetMapping("/{documentType}")
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<Map<String, Object>>> getByDocumentType(@PathVariable String documentType) {
        List<PrintTemplateConfigDto> templates = cauHinhMauInService.getByDocumentType(documentType);
        Map<String, Object> data = new HashMap<>();
        data.put("templates", templates);
        data.put("active", cauHinhMauInService.getActiveTemplateId(documentType));
        return ResponseEntity.ok(
                ResponseData.<Map<String, Object>>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(data)
                        .build()
        );
    }

    @PutMapping("/{documentType}/{templateId}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<PrintTemplateConfigDto>> upsertConfig(
            @PathVariable String documentType,
            @PathVariable String templateId,
            @RequestBody PrintTemplateConfigRequest request) {
        return ResponseEntity.ok(
                ResponseData.<PrintTemplateConfigDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(cauHinhMauInService.upsertConfig(documentType, templateId, request))
                        .build()
        );
    }

    @DeleteMapping("/{documentType}/{templateId}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<String>> resetConfig(
            @PathVariable String documentType,
            @PathVariable String templateId) {
        cauHinhMauInService.resetConfig(documentType, templateId);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data("Success")
                        .build()
        );
    }

    @PutMapping("/{documentType}/active")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<MauInDangApDung>> setActive(
            @PathVariable String documentType,
            @RequestBody ActiveTemplateRequest request) {
        return ResponseEntity.ok(
                ResponseData.<MauInDangApDung>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(cauHinhMauInService.setActive(documentType, request.getTemplateId()))
                        .build()
        );
    }

    @PostMapping("/migrate")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<Map<String, Object>>> migrate(@RequestBody MigratePrintConfigsRequest request) {
        return ResponseEntity.ok(
                ResponseData.<Map<String, Object>>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(cauHinhMauInService.migrate(request))
                        .build()
        );
    }
}
