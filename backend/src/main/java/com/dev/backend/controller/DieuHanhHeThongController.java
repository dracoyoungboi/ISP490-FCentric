package com.dev.backend.controller;

import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.CauHinhHeThongBulkUpdateRequest;
import com.dev.backend.dto.request.CauHinhHeThongUpdateRequest;
import com.dev.backend.dto.request.GanVaiTro;
import com.dev.backend.dto.request.PhanQuyenNguoiDungKhoCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.CauHinhHeThongDto;
import com.dev.backend.dto.response.entities.QuyenHanDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.QuyenHanMapper;
import com.dev.backend.services.impl.entities.NguoiDungService;
import com.dev.backend.services.impl.entities.PhanQuyenNguoiDungKhoService;
import com.dev.backend.services.impl.entities.QuyenHanService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dieu-hanh-he-thong")
class DieuHanhHeThongController {
    @Autowired
    private QuyenHanService quyenHanService;

    @Autowired
    private DieuHanhHeThongService dieuHanhHeThongService;

    @Autowired
    private PhanQuyenNguoiDungKhoService phanQuyenNguoiDungKhoService;

    @Autowired
    private QuyenHanMapper quyenHanMapper;

    @Autowired
    private NguoiDungService nguoiDungService;


    //Lấy danh sách quyền hạn trong hệ thống
    @GetMapping("/quyen-han/all")
    public ResponseEntity<ResponseData<List<QuyenHanDto>>> getAll() {
        return ResponseEntity.ok(
                ResponseData.<List<QuyenHanDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                quyenHanMapper.toDtoList(quyenHanService.getAll())
                        ).message("Success").build()
        );
    }

    // Gán quyền cho một user trong hệ thống vào một kho nào đó
    @PostMapping("/quyen-han/gan-quyen")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.cap_quyen_nhan_vien},
            inWarehouse = true,
            permissionsLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> ganQuyenNhanVienKho(
            @RequestBody PhanQuyenNguoiDungKhoCreating pqndkCreating) {

        return dieuHanhHeThongService.ganQuyenNhanVienKho(pqndkCreating);
    }

    //xoá quyền hạn của 1 user nào đó
    @DeleteMapping("/quyen-han/xoa-quyen/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.cap_quyen_nhan_vien},
            inWarehouse = true,
            permissionsLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> xoaQuyenNhanVienKho(
            @PathVariable Integer id
    ){
        PhanQuyenNguoiDungKho phanQuyenNguoiDungKho = phanQuyenNguoiDungKhoService.getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy phân quyền người dùng kho id: " + id)
        );

        phanQuyenNguoiDungKhoService.delete(phanQuyenNguoiDungKho.getId());
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .build()
        );
    }

    //gán vai trò của người dùng (chỉ quan_tri_vien được phép thực hiện)
    @PutMapping("/vai-tro/gan-vai-tro")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<String>> ganVaiTro(
            @RequestBody GanVaiTro ganVaiTro) {
        if (ganVaiTro == null || ganVaiTro.getId() == null || ganVaiTro.getVaiTro() == null || ganVaiTro.getVaiTro().isBlank()) {
            throw new CommonException("Thông tin gán vai trò không hợp lệ");
        }
        NguoiDung nguoiDung = nguoiDungService.getOne(ganVaiTro.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy người dùng id: " + ganVaiTro.getId())
        );
        nguoiDung.setVaiTro(ganVaiTro.getVaiTro());
        nguoiDungService.update(ganVaiTro.getId(), nguoiDung);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .build()
        );
    }

    // Lấy danh sách toàn bộ cấu hình hệ thống
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @GetMapping("/cau-hinh")
    public ResponseEntity<ResponseData<List<CauHinhHeThongDto>>> getAllCauHinh() {
        List<CauHinhHeThongDto> result = dieuHanhHeThongService.getAllCauHinh();
        return ResponseEntity.ok(
                ResponseData.<List<CauHinhHeThongDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(result)
                        .message("Lấy danh sách cấu hình thành công")
                        .build()
        );
    }

    // Cập nhật 1 thông số cấu hình cụ thể
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @PutMapping("/cau-hinh/{maCauHinh}")
    public ResponseEntity<ResponseData<CauHinhHeThongDto>> updateCauHinh(
            @PathVariable String maCauHinh,
            @Valid @RequestBody CauHinhHeThongUpdateRequest request,
            HttpServletRequest httpRequest) {

        Integer userId = (Integer) httpRequest.getAttribute("userId");
        CauHinhHeThongDto result = dieuHanhHeThongService.updateCauHinh(maCauHinh, request, userId);

        return ResponseEntity.ok(
                ResponseData.<CauHinhHeThongDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(result)
                        .message("Cập nhật cấu hình thành công")
                        .build()
        );
    }

    // Cập nhật hàng loạt cấu hình (Dùng cho giao diện Submit 1 lần nhiều params)
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    @PutMapping("/cau-hinh/bulk")
    public ResponseEntity<ResponseData<List<CauHinhHeThongDto>>> bulkUpdateCauHinh(
            @Valid @RequestBody List<CauHinhHeThongBulkUpdateRequest> requests,
            HttpServletRequest httpRequest) {

        Integer userId = (Integer) httpRequest.getAttribute("userId");
        List<CauHinhHeThongDto> result = dieuHanhHeThongService.bulkUpdateCauHinh(requests, userId);

        return ResponseEntity.ok(
                ResponseData.<List<CauHinhHeThongDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(result)
                        .message("Cập nhật hàng loạt cấu hình thành công")
                        .build()
        );
    }
}