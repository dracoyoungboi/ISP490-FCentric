package com.dev.backend.controller;

import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.CauHinhHeThongBulkUpdateRequest;
import com.dev.backend.dto.request.CapNhatMauQuyenRequest;
import com.dev.backend.dto.request.CauHinhHeThongUpdateRequest;
import com.dev.backend.dto.request.GanVaiTro;
import com.dev.backend.dto.request.PhanQuyenNguoiDungKhoCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.CauHinhHeThongDto;
import com.dev.backend.dto.response.entities.QuyenHanDto;
import com.dev.backend.dto.response.phanquyen.CauHinhPhanQuyenDto;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.QuyenHanMapper;
import com.dev.backend.services.impl.entities.QuyenHanService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.multitable.PhanQuyenNguoiDungService;
import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
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
    private QuyenHanMapper quyenHanMapper;

    @Autowired
    private PhanQuyenNguoiDungService phanQuyenNguoiDungService;


    //Lấy danh sách quyền hạn trong hệ thống
    @GetMapping("/quyen-han/all")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<QuyenHanDto>>> getAll() {
        return ResponseEntity.ok(
                ResponseData.<List<QuyenHanDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                quyenHanMapper.toDtoList(quyenHanService.getAll())
                        ).message("Success").build()
        );
    }

    // Gán quyền cho một user trong hệ thống vào một kho nào đó (luồng cũ; giao diện dùng PUT /admin/users/{id}/phan-quyen).
    // Quản lý kho có quyền cap_quyen_nhan_vien chỉ phân được nhân viên trong kho đang chọn, không vượt quyền của mình.
    @PostMapping("/quyen-han/gan-quyen")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.cap_quyen_nhan_vien},
            inWarehouse = true,
            permissionsLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> ganQuyenNhanVienKho(
            @RequestHeader(value = "kho_id", required = false) Integer khoIdDangChon,
            @RequestBody PhanQuyenNguoiDungKhoCreating pqndkCreating) {
        phanQuyenNguoiDungService.kiemTraGanQuyenCu(khoIdDangChon, pqndkCreating);
        return dieuHanhHeThongService.ganQuyenNhanVienKho(pqndkCreating);
    }

    // Thu hồi phân quyền kho của 1 user (không xóa hẳn, có ghi lịch sử)
    @DeleteMapping("/quyen-han/xoa-quyen/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.cap_quyen_nhan_vien},
            inWarehouse = true,
            permissionsLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> xoaQuyenNhanVienKho(
            @RequestHeader(value = "kho_id", required = false) Integer khoIdDangChon,
            @PathVariable Integer id
    ){
        phanQuyenNguoiDungService.thuHoiPhanQuyenKhoTheoId(id, khoIdDangChon);
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
        // Cùng luồng với ngăn kéo Phân quyền: chặn tự đổi, vai trò không dùng kho thì thu hồi kho, ghi lịch sử
        phanQuyenNguoiDungService.doiVaiTro(ganVaiTro.getId(), ganVaiTro.getVaiTro());
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .build()
        );
    }

    // Cấu hình cho ngăn kéo Phân quyền: mẫu quyền theo vai trò, quyền nhạy cảm, quyền máy chủ đang kiểm
    @GetMapping("/phan-quyen/cau-hinh")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<CauHinhPhanQuyenDto>> layCauHinhPhanQuyen() {
        return ResponseEntity.ok(
                ResponseData.<CauHinhPhanQuyenDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(phanQuyenNguoiDungService.layCauHinhPhanQuyen())
                        .message("Success")
                        .build()
        );
    }

    // Thay mẫu quyền của một vai trò (quản lý kho, nhân viên kho, nhân viên mua hàng, nhân viên bán hàng)
    @PutMapping("/phan-quyen/mau-quyen/{vaiTro}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<CauHinhPhanQuyenDto>> capNhatMauQuyen(
            @PathVariable String vaiTro,
            @RequestBody CapNhatMauQuyenRequest request) {
        phanQuyenNguoiDungService.capNhatMauQuyen(vaiTro, request == null ? null : request.getQuyenHanIds());
        return ResponseEntity.ok(
                ResponseData.<CauHinhPhanQuyenDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(phanQuyenNguoiDungService.layCauHinhPhanQuyen())
                        .message("Đã lưu mẫu quyền")
                        .build()
        );
    }

    // Lấy danh sách toàn bộ cấu hình hệ thống (quản lý kho chỉ xem; sửa vẫn chỉ quản trị viên)
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
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
            @Valid @RequestBody CauHinhHeThongUpdateRequest request) {

        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        Integer userId = (auth != null) ? auth.getId() : null;
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
            @Valid @RequestBody List<CauHinhHeThongBulkUpdateRequest> requests) {

        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        Integer userId = (auth != null) ? auth.getId() : null;
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