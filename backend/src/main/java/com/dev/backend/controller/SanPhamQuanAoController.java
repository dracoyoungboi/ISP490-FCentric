package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.SanPhamQuanAoBasicInfoUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoCreating;
import com.dev.backend.dto.request.SanPhamQuanAoUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.SanPhamQuanAoMapper;
import com.dev.backend.services.impl.entities.SanPhamQuanAoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/san-pham-quan-ao")
public class SanPhamQuanAoController {

        // ==========================================================
        // PRODUCT MANAGEMENT CONTROLLER
        // Vai trò: nhận request từ FE, kiểm tra quyền, gọi service,
        // và trả ResponseData thống nhất về cho UI.
        // ==========================================================

        @Autowired
        private SanPhamQuanAoService sanPhamQuanAoService;
        @Autowired
        private SanPhamQuanAoMapper sanPhamQuanAoMapper;

        @PostMapping(value = "/create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> create(
                @RequestPart("creating") SanPhamQuanAoCreating creating,
                @RequestPart(value = "anhSanPhams", required = false) List<MultipartFile> anhSanPhams,
                @RequestPart(value = "anhBienThes", required = false) List<MultipartFile> anhBienThes) {
                // FE gửi multipart gồm JSON "creating" + ảnh sản phẩm + ảnh biến thể.
                return sanPhamQuanAoService.create(creating, anhSanPhams, anhBienThes);

        }

        @PutMapping(value = "/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> update(
                @RequestPart SanPhamQuanAoUpdating updating,
                @RequestPart(value = "anhSanPhams", required = false) List<MultipartFile> anhSanPhams,
                @RequestPart(value = "anhBienThes", required = false) List<MultipartFile> anhBienThes) {
                // Cập nhật thông tin sản phẩm/biến thể và ảnh tương ứng.
                return sanPhamQuanAoService.update(updating, anhSanPhams, anhBienThes);
        }

        @GetMapping("/get-by-id/{id}")
//        @RequireAuth(roles = {
//                IRoleType.quan_tri_vien,
//                IRoleType.quan_ly_kho,
//                IRoleType.nhan_vien_kho,
//                IRoleType.nhan_vien_ban_hang,
//                IRoleType.nhan_vien_mua_hang
//        })
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> getById(@PathVariable Integer id) {
                return ResponseEntity.ok(
                        ResponseData.<SanPhamQuanAoDto>builder()
                                .status(HttpStatus.OK.value())
                                .data(sanPhamQuanAoService.getDetail(id))
                                .message("Success")
                                .build());
        }

        @PatchMapping("/basic-info/{id}")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> updateBasicInfo(
                @PathVariable Integer id,
                @RequestBody SanPhamQuanAoBasicInfoUpdating dto) {
                // Cập nhật riêng thông tin cơ bản (tên/mô tả/mã vạch/danh mục/mức tồn tối thiểu/thương hiệu).
                // KHÔNG tính lại giá/trạng thái theo tồn kho, không đụng ảnh và biến thể.
                return ResponseEntity.ok(
                        ResponseData.<SanPhamQuanAoDto>builder()
                                .status(HttpStatus.OK.value())
                                .data(sanPhamQuanAoService.updateBasicInfo(id, dto))
                                .message("Cập nhật thông tin cơ bản thành công")
                                .build());
        }

        @PostMapping("/filter")
        @RequireAuth(roles = {
                IRoleType.quan_tri_vien,
                IRoleType.quan_ly_kho,
                IRoleType.nhan_vien_kho,
                IRoleType.nhan_vien_ban_hang,
                IRoleType.nhan_vien_mua_hang
        })
        public ResponseEntity<ResponseData<Page<SanPhamQuanAoDto>>> filter(@RequestBody BaseFilterRequest filter) {
                // Luồng chính cho màn danh sách: lọc + sort + phân trang.
                return ResponseEntity.ok(
                        ResponseData.<Page<SanPhamQuanAoDto>>builder()
                                .status(HttpStatus.OK.value())
                                .data(sanPhamQuanAoMapper
                                        .toDtoPage(sanPhamQuanAoService.filter(filter)))
                                .build());
        }

        @DeleteMapping("/soft-delete/{id}")
        @RequireAuth(roles = {
                IRoleType.quan_tri_vien,
                IRoleType.quan_ly_kho,
                IRoleType.nhan_vien_kho,
                IRoleType.nhan_vien_ban_hang,
                IRoleType.nhan_vien_mua_hang
        })
        public ResponseEntity<ResponseData<String>> softDelete(@PathVariable Integer id) {
                // Xóa mềm: đổi trạng thái sang 2 (ngừng hoạt động), không xóa vật lý.
                sanPhamQuanAoService.changeStatus(id, 2);
                return ResponseEntity.ok(
                        ResponseData.<String>builder()
                                .status(HttpStatus.OK.value())
                                .data("Success")
                                .message("Success")
                                .build());
        }

        @PatchMapping("/status/{id}")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<String>> updateStatus(@PathVariable Integer id,
                                                                 @RequestParam Integer status) {
                // API đổi trạng thái nhanh cho sản phẩm.
                sanPhamQuanAoService.changeStatus(id, status);
                return ResponseEntity.ok(ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Cập nhật trạng thái thành công")
                        .build());
        }

        @PatchMapping("/sku/{id}/price")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<String>> updateSkuPrice(
                @PathVariable Integer id,
                @RequestParam(required = false) java.math.BigDecimal price,
                @RequestParam(required = false) java.math.BigDecimal cost) {
                // API cập nhật giá theo SKU (biến thể), dùng trong luồng quản lý giá.
                sanPhamQuanAoService.updateSkuPrice(id, price, cost);
                return ResponseEntity.ok(ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Cập nhật giá thành công")
                        .build());
        }

        //call api thứ 2 để lấy tất cả các sản phẩm theo khoID
        @GetMapping("/theo-kho/{khoId}")
        @RequireAuth(
                roles = {
                        IRoleType.quan_tri_vien,
                        IRoleType.quan_ly_kho,
                        IRoleType.nhan_vien_kho,
                        IRoleType.nhan_vien_mua_hang,
                        IRoleType.nhan_vien_ban_hang
                },
                rolesLogic = RequireAuth.LogicType.OR
        )
        public ResponseEntity<ResponseData<List<SanPhamQuanAoDto>>> getSanPhamByKho(@PathVariable Integer khoId) {
                return sanPhamQuanAoService.getAllByKho(khoId);
        }
}
