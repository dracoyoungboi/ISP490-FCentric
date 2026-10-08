// src/main/java/com/dev/backend/controller/PhieuKiemKeController.java
package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.ChiTietKiemKeUpdate;
import com.dev.backend.dto.request.PhieuKiemKeCreate;
import com.dev.backend.dto.response.entities.ChiTietKiemKeDto;
import com.dev.backend.dto.response.entities.DotKiemKeDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.services.impl.entities.PhieuKiemKeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/phieu-kiem-ke", "/api/v1/phieu-kiem-ke"})
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class PhieuKiemKeController {

    private final PhieuKiemKeService service;

    // GET /api/phieu-kiem-ke → danh sách tất cả đợt kiểm kê
    @GetMapping
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<DotKiemKeDto>>> getList() {
        List<DotKiemKeDto> list = service.getList();
        return ResponseEntity.ok(ResponseData.<List<DotKiemKeDto>>builder()
                .status(200)
                .data(list)
                .message("Lấy danh sách kiểm kê thành công")
                .build());
    }

    // GET /api/phieu-kiem-ke/{id} → lấy 1 đợt kiểm kê theo id
    @GetMapping("/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<DotKiemKeDto>> getById(@PathVariable Integer id) {
        DotKiemKeDto dot = service.getById(id);
        return ResponseEntity.ok(ResponseData.<DotKiemKeDto>builder()
                .status(200)
                .data(dot)
                .message("Lấy thông tin đợt kiểm kê thành công")
                .build());
    }

    // POST /api/phieu-kiem-ke → tạo đợt kiểm kê mới, trả về dotKiemKeId
    @PostMapping
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Integer>> create(@RequestBody PhieuKiemKeCreate create) {
        Integer dotKiemKeId = service.create(create);
        return ResponseEntity.ok(ResponseData.<Integer>builder()
                .status(200)
                .data(dotKiemKeId)
                .message("Tạo đợt kiểm kê thành công")
                .build());
    }

    // GET /api/phieu-kiem-ke/{id}/chi-tiet → lấy danh sách chi tiết
    @GetMapping("/{id}/chi-tiet")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<ChiTietKiemKeDto>>> getChiTiet(@PathVariable Integer id) {
        List<ChiTietKiemKeDto> list = service.getChiTiet(id);
        return ResponseEntity.ok(ResponseData.<List<ChiTietKiemKeDto>>builder()
                .status(200)
                .data(list)
                .message("Lấy chi tiết kiểm kê thành công")
                .build());
    }

    // PATCH /api/phieu-kiem-ke/{id}/complete?khoId=X → hoàn thành kiểm kê
    @PatchMapping("/{id}/complete")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> complete(
            @PathVariable Integer id,
            @RequestParam Integer khoId,
            @RequestBody List<ChiTietKiemKeUpdate> updates) {
        service.complete(id, khoId, updates);
        return ResponseEntity.ok(ResponseData.<String>builder()
                .status(200)
                .data("Success")
                .message("Hoàn thành kiểm kê thành công")
                .build());
    }
}