package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.ThuongHieuCreating;
import com.dev.backend.dto.request.ThuongHieuUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.ThuongHieuDto;
import com.dev.backend.mapper.ThuongHieuMapper;
import com.dev.backend.services.impl.entities.ThuongHieuService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/thuong-hieu")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ThuongHieuController {

    private final ThuongHieuService service;

    @Autowired
    private ThuongHieuMapper thuongHieuMapper;

    // Danh sách + lọc + phân trang thật (search mã/tên, lọc trạng thái)
    // Roles: 5 vai trò nội bộ
    @PostMapping("/filter")
    @RequireAuth(
            roles = {
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_kho
            }
    )
    public ResponseEntity<ResponseData<Page<ThuongHieuDto>>> filter(@RequestBody BaseFilterRequest filter) {
        return ResponseEntity.ok(
                ResponseData.<Page<ThuongHieuDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(thuongHieuMapper.toDtoPage(service.filter(filter)))
                        .message("Lấy danh sách thương hiệu thành công")
                        .build());
    }

    // Toàn bộ thương hiệu (kèm trạng thái) cho selector/dropdown
    // Roles: 5 vai trò nội bộ
    @GetMapping("/all")
    @RequireAuth(
            roles = {
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_kho
            }
    )
    public ResponseEntity<ResponseData<List<ThuongHieuDto>>> getAll() {
        return ResponseEntity.ok(
                ResponseData.<List<ThuongHieuDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(service.getAllDtos())
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    // Tạo thương hiệu mới
    // Roles: chỉ quan_tri_vien (master data của hệ thống)
    @PostMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<ThuongHieuDto>> create(@Valid @RequestBody ThuongHieuCreating creating) {
        return ResponseEntity.ok(ResponseData.<ThuongHieuDto>builder()
                .status(200)
                .data(service.create(creating))
                .message("Thêm thương hiệu mới thành công")
                .build());
    }

    // Cập nhật thương hiệu (bao gồm chuyển trạng thái Hoạt động/Ngừng)
    // Roles: chỉ quan_tri_vien
    @PutMapping("/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<ThuongHieuDto>> update(@PathVariable Integer id,
                                                              @Valid @RequestBody ThuongHieuUpdating updating) {
        return ResponseEntity.ok(ResponseData.<ThuongHieuDto>builder()
                .status(200)
                .data(service.update(id, updating))
                .message("Cập nhật thương hiệu thành công")
                .build());
    }

    // Upload/đổi logo thương hiệu (upload khi bấm Lưu ở FE)
    // Roles: chỉ quan_tri_vien
    @PostMapping(value = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<ThuongHieuDto>> updateLogo(@PathVariable Integer id,
                                                                  @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(ResponseData.<ThuongHieuDto>builder()
                .status(200)
                .data(service.updateLogo(id, file))
                .message("Cập nhật logo thành công")
                .build());
    }
}