package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.PhienDongGoiDto;
import com.dev.backend.services.multitable.DongGoiService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Đóng gói đơn bán (Scan-to-Pack) — bước giữa hoàn tất nhặt hàng và xác nhận xuất kho. */
@RestController
@RequestMapping("/api/v1/dong-goi")
public class DongGoiController {

    @Autowired
    private DongGoiService dongGoiService;

    @GetMapping("/don/{donBanHangId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Phiên đóng gói của đơn bán: phiếu xuất và tiến độ quét từng sản phẩm")
    public ResponseEntity<ResponseData<PhienDongGoiDto>> layPhien(@PathVariable Integer donBanHangId) {
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(),
                dongGoiService.layPhienTheoDon(donBanHangId), null, "Success"));
    }

    @PostMapping("/phieu/{phieuXuatKhoId}/quet")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Quét SKU / mã vạch để đối chiếu hàng khi đóng gói")
    public ResponseEntity<ResponseData<PhienDongGoiDto>> quet(@PathVariable Integer phieuXuatKhoId,
                                                              @Valid @RequestBody QuetBarcodeRequest request) {
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(),
                dongGoiService.quet(phieuXuatKhoId, request), null, "Quét mã đóng gói thành công"));
    }

    @PostMapping("/phieu/{phieuXuatKhoId}/hoan-tat")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Hoàn tất đóng gói: phiếu xuất sang Chờ xuất (6), đơn sang Chờ xuất kho (8)")
    public ResponseEntity<ResponseData<PhienDongGoiDto>> hoanTat(@PathVariable Integer phieuXuatKhoId) {
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(),
                dongGoiService.hoanTat(phieuXuatKhoId), null, "Hoàn tất đóng gói thành công"));
    }
}
