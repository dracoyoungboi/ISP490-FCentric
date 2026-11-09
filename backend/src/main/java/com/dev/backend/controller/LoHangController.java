package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.LoHangDto;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.LoHangMapper;
import com.dev.backend.services.impl.entities.LoHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import com.dev.backend.i18n.ThongDiep;

@RestController
@RequestMapping("/lo-hang")
public class LoHangController {

    @Autowired
    private LoHangService loHangService;

    @Autowired
    private LoHangMapper loHangMapper;


    @GetMapping("/all")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<List<LoHangDto>>> getAll() {
        return ResponseEntity.ok(
                ResponseData.<List<LoHangDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(loHangMapper.toDtoList(loHangService.getAll()))
                        .message("Success")
                        .build()
        );
    }

    @GetMapping("/get-by-id/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<LoHangDto>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<LoHangDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(loHangMapper.toDto(loHangService.getOne(id).orElseThrow(
                                () -> new CommonException(ThongDiep.of("chungTuKho.loHangKhongTimThay", id))
                        )))
                        .build()
        );
    }

    @PostMapping("/filter")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<Page<LoHangDto>>> filter(@RequestBody BaseFilterRequest filter) {
        return ResponseEntity.ok(
                ResponseData.<Page<LoHangDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(loHangMapper.toDtoPage(loHangService.filter(filter)))
                        .message("Success")
                        .build());
    }


}
