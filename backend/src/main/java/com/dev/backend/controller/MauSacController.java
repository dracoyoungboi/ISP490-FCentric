package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.MauSacCreating;
import com.dev.backend.dto.request.MauSacUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.MauSacDto;
import com.dev.backend.entities.MauSac;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.MauSacMapper;
import com.dev.backend.services.impl.entities.MauSacService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/mau-sac")
public class MauSacController {

    @Autowired
    private MauSacService mauSacService;

    @Autowired
    private MauSacMapper mauSacMapper;

    @GetMapping("/get-by-id/{id}")
    @RequireAuth(roles = {IRoleType.all})
    public ResponseEntity<ResponseData<MauSacDto>> getById(@PathVariable Integer id) {
        Optional<MauSac> finding = mauSacService.getOne(id);
        if (finding.isEmpty()) {
            throw new CommonException("Không tìm thấy màu id: " + id);
        }
        return ResponseEntity.ok(
                ResponseData.<MauSacDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(mauSacMapper.toDto(finding.get()))
                        .message("Success")
                        .build());
    }

    @GetMapping("/all")
    @RequireAuth(roles = {IRoleType.all})
    public ResponseEntity<ResponseData<List<MauSacDto>>> getAll() {
        return ResponseEntity.ok(
                ResponseData.<List<MauSacDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(mauSacMapper.toDtoList(mauSacService.getAll()))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    @PostMapping("/filter")
    @RequireAuth(roles = {IRoleType.all})
    public ResponseEntity<ResponseData<Page<MauSacDto>>> filter(@RequestBody BaseFilterRequest filter) {
        return ResponseEntity.ok(
                ResponseData.<Page<MauSacDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(mauSacMapper.toDtoPage(mauSacService.filter(filter)))
                        .message("Success")
                        .build());
    }

    @PostMapping("/create")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<MauSacDto>> create(@RequestBody MauSacCreating creating) {
        // Chuyển DTO sang Entity trước khi gọi service
        MauSac entity = mauSacMapper.toEntity(creating);
        MauSac saved = mauSacService.create(entity);
        return ResponseEntity.ok(
                ResponseData.<MauSacDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(mauSacMapper.toDto(saved))
                        .message("Success")
                        .build());
    }

    @PostMapping("/update")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<MauSacDto>> update(@RequestBody MauSacUpdating updating) {
        // Chuyển DTO sang Entity và gọi service với (ID, Entity)
        MauSac entity = mauSacMapper.toEntity(updating);
        MauSac updated = mauSacService.update(updating.getId(), entity);
        return ResponseEntity.ok(
                ResponseData.<MauSacDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(mauSacMapper.toDto(updated))
                        .message("Success")
                        .build());
    }

    @DeleteMapping("/delete/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> delete(@PathVariable Integer id) {
        Optional<MauSac> finding = mauSacService.getOne(id);
        if (finding.isEmpty()) {
            throw new CommonException("Không tìm thấy màu id: " + id);
        }
        mauSacService.delete(id);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build());
    }
}
