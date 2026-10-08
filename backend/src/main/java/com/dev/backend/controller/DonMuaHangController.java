package com.dev.backend.controller;


import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.DonMuaHangMapper;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/don-mua-hang")
public class DonMuaHangController {

    @Autowired
    private DonMuaHangService donMuaHangService;

    @Autowired
    private DonMuaHangMapper donMuaHangMapper;

    @GetMapping("/get-by-id/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<DonMuaHangDto>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<DonMuaHangDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(donMuaHangMapper.toDto(
                                donMuaHangService.getOne(id).orElseThrow(
                                        () -> new CommonException("Không tìm thấy đơn mua hàng id: " + id)
                                )
                        ))
                        .build()
        );
    }

    @PostMapping("/filter")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<DonMuaHangDto>>> filter(@RequestBody BaseFilterRequest filter) {
        return ResponseEntity.ok(
                ResponseData.<Page<DonMuaHangDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(donMuaHangMapper.toDtoPage(donMuaHangService.filter(filter)))
                        .error(null)
                        .message("Success")
                        .build()
        );
    }
}
