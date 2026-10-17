package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.KhaiBaoLoRequest;
import com.dev.backend.dto.request.PhieuNhapKhoCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.LoHangKhaiBaoDto;
import com.dev.backend.dto.response.entities.ChiTietPhieuNhapKhoDto;
import com.dev.backend.dto.response.entities.PhieuNhapKhoDto;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.mapper.PhieuNhapKhoMapper;
import com.dev.backend.services.impl.entities.PhieuNhapKhoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/phieu-nhap-kho")
public class PhieuNhapKhoController {

    @Autowired
    private PhieuNhapKhoService phieuNhapKhoService;

    @Autowired
    private PhieuNhapKhoMapper phieuNhapKhoMapper;

    @PostMapping("/filter")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public Page<PhieuNhapKhoDto> filter(@RequestBody BaseFilterRequest request) {
        Page<PhieuNhapKho> pageEntity = phieuNhapKhoService.filter(request);
        return pageEntity.map(phieuNhapKhoMapper::toDto);
    }

    @PostMapping("/create")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            permissions = {IPermissionType.tao_phieu_nhap},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public PhieuNhapKhoDto create(@RequestBody PhieuNhapKhoCreating creating) {
        PhieuNhapKho entity = phieuNhapKhoService.createDraft(creating);
        return phieuNhapKhoMapper.toDto(entity);
    }

    @GetMapping("/{id}/detail")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ChiTietPhieuNhapKhoDto getDetail(@PathVariable Integer id) {
        return phieuNhapKhoService.getDetail(id);
    }

    @PutMapping("/{id}/complete")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> completePhieuNhap(@PathVariable Integer id) {
        Integer staffId = SecurityContextHolder.getUser().getId();
        phieuNhapKhoService.completePhieuNhap(id, staffId);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Hoàn tất nhập kho thành công")
                        .data("SUCCESS")
                        .build()
        );
    }

    @PutMapping("/{id}/cancel")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            permissions = {IPermissionType.huy_phieu_nhap},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> huyPhieuNhap(@PathVariable Integer id) {
        phieuNhapKhoService.huyPhieuNhap(id);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Hủy phiếu nhập thành công")
                        .data("SUCCESS")
                        .build()
        );
    }

    @PostMapping("/{id}/khai-bao-lo")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true
    )
    public ResponseEntity<ResponseData<String>> khaiBaoLo(@PathVariable Integer id, @RequestBody KhaiBaoLoRequest requestDto) {
        phieuNhapKhoService.khaiBaoLo(id, requestDto);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Khai báo lô thành công")
                        .data("SUCCESS")
                        .build()
        );
    }

    @GetMapping("/{phieuNhapKhoId}/bien-the/{bienTheSanPhamId}/lo-hang")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<LoHangKhaiBaoDto>>> getDanhSachLoDaKhaiBao(
            @PathVariable Integer phieuNhapKhoId,
            @PathVariable Integer bienTheSanPhamId
    ) {
        List<LoHangKhaiBaoDto> data = phieuNhapKhoService.getDanhSachLoDaKhaiBao(phieuNhapKhoId, bienTheSanPhamId);
        return ResponseEntity.ok(
                ResponseData.<List<LoHangKhaiBaoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .message("OK")
                        .data(data)
                        .build()
        );
    }

    @PutMapping("/{id}/bien-the/{bienTheSanPhamId}/hoan-tat")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> hoanTatKiemDemBienThe(
            @PathVariable Integer id,
            @PathVariable Integer bienTheSanPhamId
    ) {
        phieuNhapKhoService.hoanTatKiemDemBienThe(id, bienTheSanPhamId);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Chốt hoàn tất kiểm đếm biến thể thành công")
                        .data("SUCCESS")
                        .build()
        );
    }

    @DeleteMapping("/{phieuNhapId}/lo-hang/{chiTietId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> xoaLo(@PathVariable Integer phieuNhapId, @PathVariable Integer chiTietId) {
        phieuNhapKhoService.xoaLo(phieuNhapId, chiTietId);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Xoá lô thành công")
                        .data("SUCCESS")
                        .build()
        );
    }
    @PutMapping("/{id}/complete-transfer")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> completeTransfer(@PathVariable Integer id) {
        Integer staffId = SecurityContextHolder.getUser().getId();
        phieuNhapKhoService.completeTransferReceipt(id, staffId);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Nhập kho nội bộ thành công")
                        .data("SUCCESS")
                        .build()
        );
    }
    @PostMapping("/from-transfer/{transferId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<PhieuNhapKhoDto>> createFromTransfer(@PathVariable Integer transferId) {
        PhieuNhapKho entity = phieuNhapKhoService.createImportFromTransfer(transferId);
        return ResponseEntity.ok(
                ResponseData.<PhieuNhapKhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Khởi tạo phiếu nhập chuyển kho thủ công thành công")
                        .data(phieuNhapKhoMapper.toDto(entity))
                        .build()
        );
    }
    @PostMapping("/from-sales-return/{donBanHangId}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho
            },
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<PhieuNhapKhoDto>> createReturnImportDraft(
            @PathVariable Integer donBanHangId,
            @RequestBody(required = false) java.util.Map<String, String> body
    ) {
        String ghiChu = body != null ? body.get("ghiChu") : null;
        PhieuNhapKho entity = phieuNhapKhoService.createReturnImportDraft(donBanHangId, ghiChu);

        return ResponseEntity.ok(
                ResponseData.<PhieuNhapKhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Khởi tạo phiếu nhập trả hàng thành công")
                        .data(phieuNhapKhoMapper.toDto(entity))
                        .build()
        );
    }
}