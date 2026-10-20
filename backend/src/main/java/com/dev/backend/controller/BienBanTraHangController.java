package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.services.BienBanTraHangService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BienBanTraHangController {

    BienBanTraHangService bienBanTraHangService;

    @GetMapping("/api/v1/phieu-nhap-kho/{phieuNhapKhoId}/bien-ban-tra-hang")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> layTheoPhieuNhap(@PathVariable Integer phieuNhapKhoId) {
        BienBanTraHangDto dto = bienBanTraHangService.layTheoPhieuNhap(phieuNhapKhoId);
        return ResponseEntity.ok(ResponseData.<BienBanTraHangDto>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(dto)
                .build());
    }

    @PostMapping("/api/v1/phieu-nhap-kho/{phieuNhapKhoId}/bien-ban-tra-hang")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> phatHanh(
            @PathVariable Integer phieuNhapKhoId,
            @RequestBody PhatHanhBienBanRequest request
    ) {
        Integer nguoiTaoId = SecurityContextHolder.getUser().getId();
        BienBanTraHangDto dto = bienBanTraHangService.phatHanh(phieuNhapKhoId, request, nguoiTaoId);
        return ResponseEntity.ok(ResponseData.<BienBanTraHangDto>builder()
                .status(HttpStatus.OK.value())
                // Lập lại khi phiếu không còn hàng lỗi thì biên bản bị hủy (data null): câu báo nói đúng việc đã làm
                .message(dto != null ? "Phát hành biên bản trả hàng NCC thành công"
                        : "Đã hủy biên bản trả hàng vì phiếu không còn hàng không đạt")
                .data(dto)
                .build());
    }

    @GetMapping("/api/v1/bien-ban-tra-hang-ncc")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<BienBanTraHangDto>>> dsTheoNcc(@RequestParam Integer nhaCungCapId) {
        List<BienBanTraHangDto> list = bienBanTraHangService.dsTheoNhaCungCap(nhaCungCapId);
        return ResponseEntity.ok(ResponseData.<List<BienBanTraHangDto>>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(list)
                .build());
    }

    @GetMapping("/api/v1/bien-ban-tra-hang-ncc/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> chiTiet(@PathVariable Integer id) {
        BienBanTraHangDto dto = bienBanTraHangService.chiTiet(id);
        return ResponseEntity.ok(ResponseData.<BienBanTraHangDto>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(dto)
                .build());
    }
}

