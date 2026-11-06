package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.NhatKyDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.services.impl.multitable.NhatKyDocService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Lịch sử thay đổi danh mục (lich_su_thay_doi) cho quản trị viên: GET /api/v1/admin/nhat-ky/doi-tuong?loai=&id= —
 * người dùng, danh mục, thuộc tính, nhà cung cấp, kho, khách hàng… Sản phẩm, giá bán, vị trí kệ có endpoint riêng mở
 * thêm cho quản lý kho (SanPhamQuanAoController, ViTriKhoController). Màn Nhật ký hệ thống đã bỏ theo BA (05/11).
 */
@RestController
@RequestMapping("/api/v1")
public class NhatKyController {

    private final NhatKyDocService nhatKyDocService;

    public NhatKyController(NhatKyDocService nhatKyDocService) {
        this.nhatKyDocService = nhatKyDocService;
    }

    @GetMapping("/admin/nhat-ky/doi-tuong")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<List<NhatKyDto>>> theoDoiTuong(
            @RequestParam String loai,
            @RequestParam Integer id
    ) {
        return ResponseEntity.ok(ResponseData.<List<NhatKyDto>>builder()
                .status(HttpStatus.OK.value())
                .data(nhatKyDocService.theoDoiTuongQuanTri(loai, id))
                .message("Success")
                .build());
    }
}
