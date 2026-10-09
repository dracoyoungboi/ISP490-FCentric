package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.entities.YeuCauMuaHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.YeuCauMuaHangMapper;
import com.dev.backend.services.impl.entities.YeuCauMuaHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/yeu-cau-mua-hang")
public class YeuCauMuaHangController {

    @Autowired
    private YeuCauMuaHangService yeuCauMuaHangService;
    @Autowired
    private YeuCauMuaHangMapper yeuCauMuaHangMapper;

    // Xem chi tiết yêu cầu nhập hàng (kèm lý do từ chối / ngày duyệt từ lịch sử).
    // Bắt buộc đăng nhập: dữ liệu có email, SĐT người tạo và quản lý kho.
    @GetMapping("/get-by-id/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<YeuCauMuaHangDto>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<YeuCauMuaHangDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(
                                yeuCauMuaHangService.boSungThongTinDuyet(
                                        yeuCauMuaHangMapper.toDto(yeuCauMuaHangService.getOne(id).orElseThrow(
                                                () -> new CommonException("Không tìm thấy yêu cầu mua hàng id: " + id)
                                        )))
                        )
                        .build()
        );
    }

    // Filter yêu cầu nhập hàng theo các trường của entity (bắt buộc đăng nhập)
    @PostMapping("/filter")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<YeuCauMuaHangDto>>> filter(@RequestBody BaseFilterRequest filter) {
        return ResponseEntity.ok(
                ResponseData.<Page<YeuCauMuaHangDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(yeuCauMuaHangMapper.toDtoPage(yeuCauMuaHangService.filter(filter)))
                        .message("Success")
                        .build()
        );
    }
}