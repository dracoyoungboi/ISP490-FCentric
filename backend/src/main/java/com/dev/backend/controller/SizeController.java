package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.SizeCreating;
import com.dev.backend.dto.request.SizeUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.SizeDto;
import com.dev.backend.entities.Size;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.SizeMapper;
import com.dev.backend.services.impl.entities.SizeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/size")
public class SizeController {

    @Autowired
    private SizeService sizeService;

    @Autowired
    private SizeMapper sizeMapper;

    @GetMapping("/get-by-id/{id}")
    @RequireAuth(roles = {IRoleType.all})
    public ResponseEntity<ResponseData<SizeDto>> getById(@PathVariable Integer id) {
        Optional<Size> finding = sizeService.getOne(id);
        if (finding.isEmpty()) {
            throw new CommonException("Không tìm thấy size id: " + id);
        }
        return ResponseEntity.ok(
                ResponseData.<SizeDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(sizeMapper.toDto(finding.get()))
                        .message("Success")
                        .build());
    }

    @GetMapping("/all")
    @RequireAuth(roles = {IRoleType.all})
    public ResponseEntity<ResponseData<List<SizeDto>>> getAll() {
        return ResponseEntity.ok(
                ResponseData.<List<SizeDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(sizeMapper.toDtoList(sizeService.getAll()))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    @PostMapping("/filter")
    @RequireAuth(roles = {IRoleType.all})
    public ResponseEntity<ResponseData<Page<SizeDto>>> filter(@RequestBody BaseFilterRequest filter) {
        return ResponseEntity.ok(
                ResponseData.<Page<SizeDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(sizeMapper.toDtoPage(sizeService.filter(filter)))
                        .message("Success")
                        .build());
    }

    @PostMapping("/create")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<SizeDto>> create(@RequestBody SizeCreating creating) {
        // Chuyển DTO sang Entity trước khi gọi service
        Size entity = sizeMapper.toEntity(creating);
        Size saved = sizeService.create(entity);
        return ResponseEntity.ok(
                ResponseData.<SizeDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(sizeMapper.toDto(saved))
                        .message("Success")
                        .build());
    }

    @PostMapping("/update")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<SizeDto>> update(@RequestBody SizeUpdating updating) {
        // Chuyển DTO sang Entity và gọi service với (ID, Entity)
        Size entity = sizeMapper.toEntity(updating);
        Size updated = sizeService.update(updating.getId(), entity);
        return ResponseEntity.ok(
                ResponseData.<SizeDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(sizeMapper.toDto(updated))
                        .message("Success")
                        .build());
    }

    @DeleteMapping("/delete/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> delete(@PathVariable Integer id) {
        Optional<Size> finding = sizeService.getOne(id);
        if (finding.isEmpty()) {
            throw new CommonException("Không tìm thấy size id: " + id);
        }
        sizeService.delete(id);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build());
    }
}
