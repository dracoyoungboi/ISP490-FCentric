package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.ThongTinCongTyRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.ThongTinCongTyDto;
import com.dev.backend.services.impl.entities.ThongTinCongTyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * API hồ sơ công ty dùng chung (đầu giấy của mọi mẫu in).
 * - ĐỌC: mọi tài khoản nội bộ (để in phiếu).
 * - GHI: chỉ quan_tri_vien / quan_ly_kho.
 */
@RestController
@RequestMapping("/api/v1/thong-tin-cong-ty")
public class ThongTinCongTyController {

    @Autowired
    private ThongTinCongTyService thongTinCongTyService;

    @GetMapping
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<ThongTinCongTyDto>> getProfile() {
        return ResponseEntity.ok(
                ResponseData.<ThongTinCongTyDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(thongTinCongTyService.getProfile())
                        .build()
        );
    }

    @PutMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<ThongTinCongTyDto>> updateProfile(@RequestBody ThongTinCongTyRequest request) {
        return ResponseEntity.ok(
                ResponseData.<ThongTinCongTyDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(thongTinCongTyService.updateProfile(request))
                        .build()
        );
    }

    @PostMapping(value = "/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<ThongTinCongTyDto>> updateLogo(@RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(
                ResponseData.<ThongTinCongTyDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(thongTinCongTyService.updateLogo(file))
                        .build()
        );
    }
}
