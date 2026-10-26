package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.CauHinhTemDto;
import com.dev.backend.dto.response.customize.DongInTemDto;
import com.dev.backend.services.impl.entities.TemSanPhamService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Hộp "In tem sản phẩm" (màn Giá bán & tem mã vạch, chi tiết phiếu nhập): cấu hình tem và tra mã quét.
 * Mở cho nhân viên kho vì in tem theo phiếu nhập là việc của kho; không trả giá vốn.
 */
@RestController
@RequestMapping("/api/v1/tem-san-pham")
public class TemSanPhamController {

    @Autowired
    private TemSanPhamService temSanPhamService;

    @GetMapping("/cau-hinh")
    @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho })
    public ResponseEntity<ResponseData<CauHinhTemDto>> cauHinh() {
        return ResponseEntity.ok(ResponseData.<CauHinhTemDto>builder()
                .status(HttpStatus.OK.value())
                .data(temSanPhamService.cauHinh())
                .message("Success")
                .build());
    }

    /** Quét mã để thêm 1 tem: khớp đúng mã vạch hoặc SKU; không có SKU nào thì data = null. */
    @GetMapping("/tra-ma")
    @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho })
    public ResponseEntity<ResponseData<DongInTemDto>> traMa(@RequestParam("ma") String ma) {
        return ResponseEntity.ok(ResponseData.<DongInTemDto>builder()
                .status(HttpStatus.OK.value())
                .data(temSanPhamService.traMa(ma))
                .message("Success")
                .build());
    }
}
