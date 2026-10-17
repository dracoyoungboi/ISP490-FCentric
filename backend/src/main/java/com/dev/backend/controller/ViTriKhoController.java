package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.inbound.KhuVucKhoRequest;
import com.dev.backend.dto.request.inbound.ViTriKhoRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.inbound.KhuVucKhoDto;
import com.dev.backend.dto.response.inbound.LoTrenKeDto;
import com.dev.backend.dto.response.inbound.ViTriKhoDto;
import com.dev.backend.services.ViTriKhoService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/kho/{khoId}")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ViTriKhoController {

    ViTriKhoService viTriKhoService;

    // ── Khu vực ──

    @GetMapping("/khu-vuc")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<KhuVucKhoDto>>> dsKhuVuc(@PathVariable Integer khoId) {
        List<KhuVucKhoDto> list = viTriKhoService.dsKhuVuc(khoId);
        return ResponseEntity.ok(ResponseData.<List<KhuVucKhoDto>>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(list)
                .build());
    }

    @PostMapping("/khu-vuc")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<KhuVucKhoDto>> taoKhuVuc(@PathVariable Integer khoId,
                                                                 @RequestBody KhuVucKhoRequest request) {
        KhuVucKhoDto dto = viTriKhoService.taoKhuVuc(khoId, request);
        return ResponseEntity.ok(ResponseData.<KhuVucKhoDto>builder()
                .status(HttpStatus.OK.value())
                .message("Tạo khu vực thành công")
                .data(dto)
                .build());
    }

    @PutMapping("/khu-vuc/{khuVucId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<KhuVucKhoDto>> suaKhuVuc(@PathVariable Integer khoId,
                                                                 @PathVariable Integer khuVucId,
                                                                 @RequestBody KhuVucKhoRequest request) {
        KhuVucKhoDto dto = viTriKhoService.suaKhuVuc(khoId, khuVucId, request);
        return ResponseEntity.ok(ResponseData.<KhuVucKhoDto>builder()
                .status(HttpStatus.OK.value())
                .message("Cập nhật khu vực thành công")
                .data(dto)
                .build());
    }

    @DeleteMapping("/khu-vuc/{khuVucId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> xoaKhuVuc(@PathVariable Integer khoId,
                                                           @PathVariable Integer khuVucId) {
        viTriKhoService.xoaKhuVuc(khoId, khuVucId);
        return ResponseEntity.ok(ResponseData.<String>builder()
                .status(HttpStatus.OK.value())
                .message("Xóa khu vực thành công")
                .data("SUCCESS")
                .build());
    }

    // ── Vị trí kệ ──

    @GetMapping("/vi-tri")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<ViTriKhoDto>>> dsViTri(
            @PathVariable Integer khoId,
            @RequestParam(required = false, defaultValue = "false") Boolean khaDung
    ) {
        List<ViTriKhoDto> list = Boolean.TRUE.equals(khaDung)
                ? viTriKhoService.dsViTriKhaDung(khoId)
                : viTriKhoService.dsViTri(khoId);

        return ResponseEntity.ok(ResponseData.<List<ViTriKhoDto>>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(list)
                .build());
    }

    @PostMapping("/vi-tri")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<ViTriKhoDto>>> taoViTri(@PathVariable Integer khoId,
                                                                    @RequestBody ViTriKhoRequest request) {
        List<ViTriKhoDto> list = viTriKhoService.taoViTri(khoId, request);
        return ResponseEntity.ok(ResponseData.<List<ViTriKhoDto>>builder()
                .status(HttpStatus.OK.value())
                .message("Tạo vị trí kệ thành công")
                .data(list)
                .build());
    }

    @PutMapping("/vi-tri/{viTriId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<ViTriKhoDto>> suaViTri(@PathVariable Integer khoId,
                                                               @PathVariable Integer viTriId,
                                                               @RequestBody ViTriKhoRequest request) {
        ViTriKhoDto dto = viTriKhoService.suaViTri(khoId, viTriId, request);
        return ResponseEntity.ok(ResponseData.<ViTriKhoDto>builder()
                .status(HttpStatus.OK.value())
                .message("Cập nhật vị trí kệ thành công")
                .data(dto)
                .build());
    }

    @DeleteMapping("/vi-tri/{viTriId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> xoaViTri(@PathVariable Integer khoId,
                                                          @PathVariable Integer viTriId) {
        viTriKhoService.xoaViTri(khoId, viTriId);
        return ResponseEntity.ok(ResponseData.<String>builder()
                .status(HttpStatus.OK.value())
                .message("Xóa vị trí kệ thành công")
                .data("SUCCESS")
                .build());
    }

    @GetMapping("/vi-tri/{viTriId}/lo-hang")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<LoTrenKeDto>>> loTrenKe(@PathVariable Integer khoId,
                                                                     @PathVariable Integer viTriId) {
        List<LoTrenKeDto> list = viTriKhoService.loTrenKe(khoId, viTriId);
        return ResponseEntity.ok(ResponseData.<List<LoTrenKeDto>>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(list)
                .build());
    }

    // ── Mặt bằng ──

    @GetMapping("/mat-bang")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Map<String, Object>>> layMatBang(@PathVariable Integer khoId) {
        Map<String, Object> mb = viTriKhoService.layMatBang(khoId);
        return ResponseEntity.ok(ResponseData.<Map<String, Object>>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(mb)
                .build());
    }

    @PutMapping("/mat-bang")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Map<String, Object>>> luuMatBang(@PathVariable Integer khoId,
                                                                         @RequestBody Map<String, Object> matBang) {
        Map<String, Object> saved = viTriKhoService.luuMatBang(khoId, matBang);
        return ResponseEntity.ok(ResponseData.<Map<String, Object>>builder()
                .status(HttpStatus.OK.value())
                .message("Lưu mặt bằng kho thành công")
                .data(saved)
                .build());
    }
}

